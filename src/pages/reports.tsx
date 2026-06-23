// src/pages/reports.tsx

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { app } from '../lib/firebase';
import * as XLSX from '@/lib/sheetjs/xlsx.mjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Shadcn UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// Icons from lucide-react
import { 
  Home,
  Users,
  GraduationCap,
  Heart,
  Briefcase,
  Route,
  Trees,
  Droplets,
  Coins,
  FileDown,
  RefreshCw,
  Calendar,
  MapPin,
  Building,
  FileSpreadsheet,
  Eye,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

// Utility function for Indian number formatting
const formatIndianNumber = (num: number): string => {
  if (num === 0) return '0';
  
  const numStr = Math.abs(num).toString();
  const isNegative = num < 0;
  
  const parts = numStr.split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1] ? '.' + parts[1] : '';
  
  let formatted = '';
  
  if (integerPart.length > 3) {
    const lastThree = integerPart.slice(-3);
    const remaining = integerPart.slice(0, -3);
    
    if (remaining.length > 0) {
      formatted = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    } else {
      formatted = lastThree;
    }
  } else {
    formatted = integerPart;
  }
  
  return (isNegative ? '-' : '') + formatted + decimalPart;
};

// Format currency in Indian format
const formatIndianCurrency = (amount: number): string => {
  if (amount === 0) return '₹0';
  
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;
  const prefix = isNegative ? '-₹' : '₹';
  
  if (absAmount >= 10000000) { // 1 crore
    const crores = absAmount / 10000000;
    return prefix + formatIndianNumber(Math.round(crores * 100) / 100) + ' Cr';
  } else if (absAmount >= 100000) { // 1 lakh
    const lakhs = absAmount / 100000;
    return prefix + formatIndianNumber(Math.round(lakhs * 100) / 100) + ' L';
  } else if (absAmount >= 1000) { // 1 thousand
    const thousands = absAmount / 1000;
    return prefix + formatIndianNumber(Math.round(thousands * 100) / 100) + ' K';
  } else {
    return prefix + formatIndianNumber(absAmount);
  }
};

// Map each report display section to the possible keys it may be saved under in
// Firestore. The data-collection page saves sections under short keys
// (e.g. "HealthChildcare"), while some older data may use the long display name.
// Resolving both keeps the report in sync with what is actually stored.
const SECTION_KEYS: { [display: string]: string[] } = {
  'Demographics': ['Demographics'],
  'Education': ['Education'],
  'Health and Childcare': ['Health and Childcare', 'HealthChildcare'],
  'Migration and Employment': ['Migration and Employment', 'MigrationEmployment'],
  'Road Infrastructure': ['Road Infrastructure', 'RoadInfrastructure'],
  'Panchayat Finances': ['Panchayat Finances', 'PanchayatFinances'],
  'Land Use Mapping': ['Land Use Mapping', 'LandUseMapping'],
  'Water Resources': ['Water Resources', 'WaterResources'],
};

// Return the saved data for a display section, checking every known key variant.
const resolveSection = (formData: any, display: string): any => {
  if (!formData) return undefined;
  const keys = SECTION_KEYS[display] || [display];
  for (const k of keys) {
    const v = formData[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};

// Determine whether a section actually contains meaningful data. Handles arrays
// (e.g. Migration), village-keyed objects (e.g. Demographics) and flat objects
// with nested arrays (e.g. Water Resources) or numeric values (e.g. Finances).
const sectionHasData = (data: any): boolean => {
  if (data === undefined || data === null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') {
    return Object.values(data).some(v => {
      if (Array.isArray(v)) return v.length > 0;
      if (v && typeof v === 'object') return Object.keys(v).length > 0;
      return v !== undefined && v !== null && v !== '' && v !== 0;
    });
  }
  return false;
};

const Reports: React.FC = () => {
  const [userData, setUserData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  
  const router = useRouter();
  const auth = getAuth(app);
  const db = getFirestore(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserData(userData);
          fetchAvailableYears(user.uid, userData.gpName);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, auth, db]);

  const fetchAvailableYears = async (userId: string, gpName: string) => {
    const collectionsQuery = query(
      collection(db, 'dataCollections'),
      where('gpName', '==', gpName)
    );
    const querySnapshot = await getDocs(collectionsQuery);
    const years = querySnapshot.docs.map(doc => doc.data().financialYear);
    setAvailableYears(Array.from(new Set(years)).sort());
    if (years.length > 0) {
      setSelectedYear(years[years.length - 1]);
    }
    setLoading(false);
  };

  const fetchReportData = async (year: string) => {
    setLoading(true);
    const collectionsQuery = query(
      collection(db, 'dataCollections'),
      where('gpName', '==', userData.gpName),
      where('financialYear', '==', year)
    );
    const querySnapshot = await getDocs(collectionsQuery);
    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      setReportData(data);
    } else {
      setReportData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedYear && userData) {
      fetchReportData(selectedYear);
    }
  }, [selectedYear, userData]);

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = document.getElementById('pdf-content');
      if (!element) {
        throw new Error('PDF content element not found');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let yPosition = 10;
      let pageHeight = imgHeight;
      
      if (pageHeight > pdfHeight - 20) {
        while (pageHeight > 0) {
          pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, imgHeight);
          pageHeight -= pdfHeight;
          if (pageHeight > 0) {
            pdf.addPage();
            yPosition = -pdfHeight + 10;
          }
        }
      } else {
        const yOffset = (pdfHeight - imgHeight - 20) / 2;
        pdf.addImage(imgData, 'PNG', 10, yOffset + 10, imgWidth, imgHeight);
      }
      
      const fileName = `${userData.gpName}_Report_${selectedYear}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const exportToExcel = async () => {
    setIsExportingExcel(true);
    try {
      if (!reportData || !reportData.formData) {
        alert('No data available to export');
        return;
      }

      const workbook = XLSX.utils.book_new();
      const formData = reportData.formData;

      // Append a worksheet only when there are rows to write. Sheet names are
      // capped at Excel's 31-character limit.
      const appendSheet = (rows: any[], name: string) => {
        if (rows && rows.length > 0) {
          const sheet = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
        }
      };

      // Demographics worksheet
      const demographics = resolveSection(formData, 'Demographics');
      if (demographics && typeof demographics === 'object') {
        appendSheet(
          Object.entries(demographics).map(([village, data]) => ({
            Village: village,
            ...((typeof data === 'object' && data !== null) ? data : {})
          })),
          'Demographics'
        );
      }

      // Education worksheet
      const education = resolveSection(formData, 'Education');
      if (education && typeof education === 'object') {
        const educationData: any[] = [];
        Object.entries(education).forEach(([village, schools]: [string, any]) => {
          if (Array.isArray(schools)) {
            schools.forEach(school => {
              educationData.push({
                Village: village,
                'School Name': school.name,
                'Teachers (Male)': school.teachersMale,
                'Teachers (Female)': school.teachersFemale,
                'Total Students': school.studentsTotal,
                'Students (Male)': school.studentsMale,
                'Students (Female)': school.studentsFemale,
                'New Classrooms Required': school.newClassroomsRequired,
                'Infrastructure Status': school.infrastructureStatus
              });
            });
          }
        });
        appendSheet(educationData, 'Education');
      }

      // Health and Childcare worksheet
      const health = resolveSection(formData, 'Health and Childcare');
      if (health && typeof health === 'object') {
        const typeLabels: { [key: string]: string } = {
          phcs: 'Primary Health Centre',
          subCentres: 'Sub-Centre',
          anganwadiCentres: 'Anganwadi Centre',
        };
        const healthData: any[] = [];
        ['phcs', 'subCentres', 'anganwadiCentres'].forEach(key => {
          const facilities = (health as any)[key];
          if (Array.isArray(facilities)) {
            facilities.forEach((f: any) => healthData.push({
              'Facility Type': typeLabels[key],
              Name: f.name,
              Location: f.location === 'Other' ? f.otherLocation : f.location,
              Status: f.status,
            }));
          }
        });
        appendSheet(healthData, 'Health & Childcare');
      }

      // Migration and Employment worksheet
      const migration = resolveSection(formData, 'Migration and Employment');
      if (Array.isArray(migration)) {
        appendSheet(
          migration.map((r: any) => ({
            Village: r.village,
            'Households Reporting Migration': r.householdsReportingMigration,
            'Seasonal Migrants (Male)': r.seasonalMigrantsMale,
            'Seasonal Migrants (Female)': r.seasonalMigrantsFemale,
            'Permanent Migrants (Male)': r.permanentMigrantsMale,
            'Permanent Migrants (Female)': r.permanentMigrantsFemale,
            'Landless Households': r.landlessHouseholds,
            'Households with MGNREGS Cards': r.householdsWithMGNREGSCards,
            'Workdays Provided under MGNREGS': r.workdaysProvidedMGNREGS,
          })),
          'Migration & Employment'
        );
      }

      // Road Infrastructure worksheet
      const roads = resolveSection(formData, 'Road Infrastructure');
      if (Array.isArray(roads)) {
        appendSheet(
          roads.map((r: any) => ({
            Village: r.village,
            'Total CC Road (km)': r.totalCCRoad,
            'CC Road Required (km)': r.ccRoadRequired,
            'Repair Required (km)': r.repairRequired,
            'Kuchha Road (km)': r.kuchhaRoad,
          })),
          'Road Infrastructure'
        );
      }

      // Panchayat Finances worksheet
      const finances = resolveSection(formData, 'Panchayat Finances');
      if (finances && typeof finances === 'object') {
        appendSheet(
          [{
            'CFC (₹)': finances.cfc,
            'SFC (₹)': finances.sfc,
            'Own Sources (₹)': finances.ownSources,
            'MGNREGS (₹)': finances.mgnregs,
            'Total (₹)':
              (Number(finances.cfc) || 0) +
              (Number(finances.sfc) || 0) +
              (Number(finances.ownSources) || 0) +
              (Number(finances.mgnregs) || 0),
          }],
          'Panchayat Finances'
        );
      }

      // Land Use Mapping worksheets
      const landUse = resolveSection(formData, 'Land Use Mapping');
      if (landUse && typeof landUse === 'object') {
        if (Array.isArray(landUse.landUseData)) {
          appendSheet(
            landUse.landUseData.map((r: any) => ({
              Village: r.village,
              'Total Cultivable Land (ha)': r.totalCultivableLand,
              'Irrigated Land (ha)': r.irrigatedLand,
              'Forest Area (ha)': r.forestArea,
            })),
            'Land Use'
          );
        }
        if (Array.isArray(landUse.commonLandAreas)) {
          appendSheet(
            landUse.commonLandAreas.map((a: any) => ({
              Location: a.location,
              'Area (ha)': a.area,
              Uses: a.uses,
            })),
            'Common Land Areas'
          );
        }
      }

      // Water Resources worksheets
      const water = resolveSection(formData, 'Water Resources');
      if (water && typeof water === 'object') {
        if (Array.isArray(water.waterBodies)) {
          appendSheet(
            water.waterBodies.map((b: any) => ({
              Type: b.type === 'Others' ? b.otherType : b.type,
              Locations: Array.isArray(b.locations) ? b.locations.join(', ') : '',
              'Water Level': b.waterLevel,
              Condition: b.condition,
              'Irrigation Potential (ha)': b.irrigationPotential,
            })),
            'Water Bodies'
          );
        }
        if (Array.isArray(water.irrigationStructures)) {
          appendSheet(
            water.irrigationStructures.map((s: any) => ({
              Type: s.type === 'Others' ? s.otherType : s.type,
              Location: s.location,
              Status: s.status,
              'Irrigation Potential (ha)': s.irrigationPotential,
            })),
            'Irrigation Structures'
          );
        }
      }

      if (workbook.SheetNames.length === 0) {
        alert('No data available to export');
        return;
      }

      const fileName = `${userData.gpName}_Data_${selectedYear}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel. Please try again.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const calculateCompletionStatus = () => {
    if (!reportData || !reportData.formData) return 0;

    const requiredForms = Object.keys(SECTION_KEYS);

    const filledForms = requiredForms.filter(form =>
      sectionHasData(resolveSection(reportData.formData, form))
    );

    return Math.round((filledForms.length / requiredForms.length) * 100);
  };

  const renderDataSection = (title: string, icon: React.ReactNode, data: any, color: string) => {
    if (!sectionHasData(data)) {
      return (
        <Card className="border-2 border-gray-200 shadow-md">
          <CardHeader className={`bg-gray-50 border-b border-gray-200`}>
            <CardTitle className="text-lg flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No data available for this section</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={`border-2 shadow-lg`} style={{ borderColor: color }}>
        <CardHeader className={`border-b`} style={{ backgroundColor: `${color}20`, borderColor: color }}>
          <CardTitle className="text-lg flex items-center gap-2" style={{ color }}>
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {title === 'Demographics' && typeof data === 'object' && (
            Object.entries(data).map(([village, villageData]: [string, any]) => (
              <div key={village} className="mb-4 last:mb-0">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h5 className="font-semibold mb-3 text-blue-800 flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    {village}
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-white p-2 rounded border">
                      <span className="text-gray-600">Population:</span>
                      <span className="font-medium text-gray-800 ml-2">
                        {villageData.totalPopulation ? formatIndianNumber(parseInt(villageData.totalPopulation)) : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <span className="text-gray-600">Households:</span>
                      <span className="font-medium text-gray-800 ml-2">
                        {villageData.households ? formatIndianNumber(parseInt(villageData.households)) : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <span className="text-gray-600">Male:</span>
                      <span className="font-medium text-gray-800 ml-2">
                        {villageData.malePopulation ? formatIndianNumber(parseInt(villageData.malePopulation)) : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <span className="text-gray-600">Female:</span>
                      <span className="font-medium text-gray-800 ml-2">
                        {villageData.femalePopulation ? formatIndianNumber(parseInt(villageData.femalePopulation)) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {title === 'Education' && typeof data === 'object' && (
            Object.entries(data).map(([village, schools]: [string, any]) => (
              <div key={village} className="mb-4 last:mb-0">
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                  <h5 className="font-semibold mb-3 text-purple-800 flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    {village}
                  </h5>
                  {Array.isArray(schools) && schools.map((school: any, idx: number) => (
                    <div key={idx} className="mb-3 last:mb-0">
                      <div className="bg-white p-3 rounded border">
                        <div className="font-medium text-gray-800 mb-2">{school.name}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Teachers:</span>
                            <span className="ml-2">{(parseInt(school.teachersMale || 0) + parseInt(school.teachersFemale || 0))}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Students:</span>
                            <span className="ml-2">{school.studentsTotal || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {title === 'Panchayat Finances' && typeof data === 'object' && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <h5 className="font-semibold mb-3 text-green-800 flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Financial Breakdown
              </h5>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-3 rounded border">
                  <span className="text-gray-600">CFC:</span>
                  <span className="font-bold text-green-600 ml-2">{formatIndianCurrency(parseInt(data.cfc || 0))}</span>
                </div>
                <div className="bg-white p-3 rounded border">
                  <span className="text-gray-600">SFC:</span>
                  <span className="font-bold text-green-600 ml-2">{formatIndianCurrency(parseInt(data.sfc || 0))}</span>
                </div>
                <div className="bg-white p-3 rounded border">
                  <span className="text-gray-600">Own Sources:</span>
                  <span className="font-bold text-green-600 ml-2">{formatIndianCurrency(parseInt(data.ownSources || 0))}</span>
                </div>
                <div className="bg-white p-3 rounded border">
                  <span className="text-gray-600">MGNREGS:</span>
                  <span className="font-bold text-green-600 ml-2">{formatIndianCurrency(parseInt(data.mgnregs || 0))}</span>
                </div>
              </div>
              <div className="mt-3 p-3 bg-white rounded border">
                <span className="text-gray-600 font-medium">Total Funds:</span>
                <span className="font-bold text-green-700 ml-2 text-lg">
                  {formatIndianCurrency(
                    parseInt(data.cfc || 0) + 
                    parseInt(data.sfc || 0) + 
                    parseInt(data.ownSources || 0) + 
                    parseInt(data.mgnregs || 0)
                  )}
                </span>
              </div>
            </div>
          )}

          {title === 'Health and Childcare' && typeof data === 'object' && (
            <div className="space-y-4">
              {[
                { key: 'phcs', label: 'Primary Health Centres (PHCs)' },
                { key: 'subCentres', label: 'Sub-Centres (SCs)' },
                { key: 'anganwadiCentres', label: 'Anganwadi Centres' },
              ].map(({ key, label }) => {
                const facilities = Array.isArray(data[key]) ? data[key] : [];
                if (facilities.length === 0) return null;
                return (
                  <div key={key} className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <h5 className="font-semibold mb-3 text-red-800 flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      {label} ({facilities.length})
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {facilities.map((f: any) => (
                        <div key={f.id} className="bg-white p-3 rounded border text-sm">
                          <div className="font-medium text-gray-800">{f.name || 'Unnamed'}</div>
                          <div className="text-gray-600">
                            Location: {f.location === 'Other' ? (f.otherLocation || 'Other') : (f.location || 'N/A')}
                          </div>
                          <div className="text-gray-600">Status: {f.status || 'N/A'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {title === 'Migration and Employment' && Array.isArray(data) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-amber-100 text-amber-900">
                    <th className="border border-amber-200 p-2 text-left">Village</th>
                    <th className="border border-amber-200 p-2">HHs Migrating</th>
                    <th className="border border-amber-200 p-2">Seasonal (M/F)</th>
                    <th className="border border-amber-200 p-2">Permanent (M/F)</th>
                    <th className="border border-amber-200 p-2">Landless HHs</th>
                    <th className="border border-amber-200 p-2">MGNREGS Cards</th>
                    <th className="border border-amber-200 p-2">MGNREGS Workdays</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any, idx: number) => (
                    <tr key={idx} className="even:bg-amber-50">
                      <td className="border border-amber-200 p-2 font-medium">{row.village}</td>
                      <td className="border border-amber-200 p-2 text-center">{row.householdsReportingMigration || 0}</td>
                      <td className="border border-amber-200 p-2 text-center">{(row.seasonalMigrantsMale || 0)} / {(row.seasonalMigrantsFemale || 0)}</td>
                      <td className="border border-amber-200 p-2 text-center">{(row.permanentMigrantsMale || 0)} / {(row.permanentMigrantsFemale || 0)}</td>
                      <td className="border border-amber-200 p-2 text-center">{row.landlessHouseholds || 0}</td>
                      <td className="border border-amber-200 p-2 text-center">{row.householdsWithMGNREGSCards || 0}</td>
                      <td className="border border-amber-200 p-2 text-center">{row.workdaysProvidedMGNREGS || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {title === 'Road Infrastructure' && Array.isArray(data) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-800">
                    <th className="border border-gray-200 p-2 text-left">Village</th>
                    <th className="border border-gray-200 p-2">Total CC Road (km)</th>
                    <th className="border border-gray-200 p-2">CC Road Required (km)</th>
                    <th className="border border-gray-200 p-2">Repair Required (km)</th>
                    <th className="border border-gray-200 p-2">Kuchha Road (km)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any, idx: number) => (
                    <tr key={idx} className="even:bg-gray-50">
                      <td className="border border-gray-200 p-2 font-medium">{row.village}</td>
                      <td className="border border-gray-200 p-2 text-center">{row.totalCCRoad || 0}</td>
                      <td className="border border-gray-200 p-2 text-center">{row.ccRoadRequired || 0}</td>
                      <td className="border border-gray-200 p-2 text-center">{row.repairRequired || 0}</td>
                      <td className="border border-gray-200 p-2 text-center">{row.kuchhaRoad || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {title === 'Land Use Mapping' && typeof data === 'object' && (
            <div className="space-y-4">
              {Array.isArray(data.landUseData) && data.landUseData.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-emerald-100 text-emerald-900">
                        <th className="border border-emerald-200 p-2 text-left">Village</th>
                        <th className="border border-emerald-200 p-2">Cultivable Land (ha)</th>
                        <th className="border border-emerald-200 p-2">Irrigated Land (ha)</th>
                        <th className="border border-emerald-200 p-2">Forest Area (ha)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.landUseData.map((row: any, idx: number) => (
                        <tr key={idx} className="even:bg-emerald-50">
                          <td className="border border-emerald-200 p-2 font-medium">{row.village}</td>
                          <td className="border border-emerald-200 p-2 text-center">{row.totalCultivableLand || 0}</td>
                          <td className="border border-emerald-200 p-2 text-center">{row.irrigatedLand || 0}</td>
                          <td className="border border-emerald-200 p-2 text-center">{row.forestArea || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {Array.isArray(data.commonLandAreas) && data.commonLandAreas.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-2 text-emerald-800">Common Land Areas</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {data.commonLandAreas.map((area: any) => (
                      <div key={area.id} className="bg-white p-3 rounded border text-sm">
                        <div className="font-medium text-gray-800">{area.location}</div>
                        <div className="text-gray-600">Area: {area.area || 0} ha</div>
                        <div className="text-gray-600">Uses: {area.uses || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {title === 'Water Resources' && typeof data === 'object' && (
            <div className="space-y-4">
              {Array.isArray(data.waterBodies) && data.waterBodies.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-2 text-cyan-800 flex items-center gap-2">
                    <Droplets className="h-4 w-4" />
                    Water Bodies ({data.waterBodies.length})
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.waterBodies.map((body: any) => (
                      <div key={body.id} className="bg-white p-3 rounded border text-sm">
                        <div className="font-medium text-gray-800">{body.type === 'Others' ? (body.otherType || 'Other') : body.type}</div>
                        <div className="text-gray-600">Locations: {Array.isArray(body.locations) ? body.locations.join(', ') : 'N/A'}</div>
                        <div className="text-gray-600">Water Level: {body.waterLevel || 'N/A'}</div>
                        <div className="text-gray-600">Condition: {body.condition || 'N/A'}</div>
                        <div className="text-gray-600">Irrigation Potential: {body.irrigationPotential || 0} ha</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(data.irrigationStructures) && data.irrigationStructures.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-2 text-cyan-800">Irrigation Structures ({data.irrigationStructures.length})</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.irrigationStructures.map((s: any) => (
                      <div key={s.id} className="bg-white p-3 rounded border text-sm">
                        <div className="font-medium text-gray-800">{s.type === 'Others' ? (s.otherType || 'Other') : s.type}</div>
                        <div className="text-gray-600">Location: {s.location || 'N/A'}</div>
                        <div className="text-gray-600">Status: {s.status || 'N/A'}</div>
                        <div className="text-gray-600">Irrigation Potential: {s.irrigationPotential || 0} ha</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading report data...</p>
        </Card>
      </div>
    );
  }

  const completionStatus = calculateCompletionStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-600 to-green-600 text-white mb-8">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-3xl font-bold flex items-center gap-3">
                  <FileDown className="h-8 w-8" />
                  GP Data Collection Report
                </CardTitle>
                <CardDescription className="text-blue-50 mt-2 text-lg">
                  {userData?.gpName} • {userData?.district} • {userData?.block}
                </CardDescription>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={generatePDF}
                  disabled={isGeneratingPDF || !reportData}
                  className="bg-white bg-opacity-20 hover:bg-white hover:bg-opacity-30 text-white border-white border"
                >
                  {isGeneratingPDF ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>
                <Button 
                  onClick={exportToExcel}
                  disabled={isExportingExcel || !reportData}
                  className="bg-white bg-opacity-20 hover:bg-white hover:bg-opacity-30 text-white border-white border"
                >
                  {isExportingExcel ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export Excel
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Year Selection and Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Financial Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Completion Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Data Filled</span>
                  <Badge variant={completionStatus === 100 ? "default" : completionStatus >= 50 ? "secondary" : "destructive"}>
                    {completionStatus}%
                  </Badge>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      completionStatus === 100 ? 'bg-green-600' : 
                      completionStatus >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${completionStatus}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{userData?.gpName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span>{userData?.block}, {userData?.district}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Content */}
        {reportData ? (
          <ScrollArea>
            <div id="pdf-content" className="space-y-6 bg-white p-6 rounded-lg">
              {/* PDF Header */}
              <div className="text-center border-b-2 border-blue-600 pb-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                  Gram Panchayat Data Collection Report
                </h1>
                <h2 className="text-xl font-semibold text-blue-600 mb-1">
                  {userData?.gpName}
                </h2>
                <p className="text-gray-600">
                  {userData?.district} • {userData?.block} • {selectedYear}
                </p>
              </div>

              {/* Submission Info */}
              <Card className="bg-white border-2 border-gray-200 shadow-lg mb-6">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                  <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Submission Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <span className="text-blue-600 font-medium">Submitted by:</span>
                      <div className="font-semibold text-gray-800 mt-1">{reportData.userDetails?.name || 'Unknown User'}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <span className="text-green-600 font-medium">Email:</span>
                      <div className="font-semibold text-gray-800 mt-1">{reportData.userDetails?.email || 'N/A'}</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <span className="text-purple-600 font-medium">Submitted on:</span>
                      <div className="font-semibold text-gray-800 mt-1">{new Date(reportData.submittedAt).toLocaleString()}</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <span className="text-orange-600 font-medium">Last updated:</span>
                      <div className="font-semibold text-gray-800 mt-1">
                        {reportData.lastUpdatedAt ? new Date(reportData.lastUpdatedAt).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Sections */}
              <div className="space-y-6">
                {renderDataSection(
                  'Demographics',
                  <Users className="h-5 w-5" />,
                  resolveSection(reportData.formData, 'Demographics'),
                  '#3b82f6'
                )}

                {renderDataSection(
                  'Education',
                  <GraduationCap className="h-5 w-5" />,
                  resolveSection(reportData.formData, 'Education'),
                  '#8b5cf6'
                )}

                {renderDataSection(
                  'Health and Childcare',
                  <Heart className="h-5 w-5" />,
                  resolveSection(reportData.formData, 'Health and Childcare'),
                  '#ef4444'
                )}

                {renderDataSection(
                  'Migration and Employment',
                  <Briefcase className="h-5 w-5" />,
                  resolveSection(reportData.formData, 'Migration and Employment'),
                  '#f59e0b'
                )}

                {renderDataSection(
                  'Road Infrastructure',
                  <Route className="h-5 w-5" />,
                  resolveSection(reportData.formData, 'Road Infrastructure'),
                  '#6b7280'
                )}

                {renderDataSection(
                  'Panchayat Finances',
                  <Coins className="h-5 w-5" />,
                  resolveSection(reportData.formData, 'Panchayat Finances'),
                  '#10b981'
                )}

                {renderDataSection(
                  'Land Use Mapping',
                  <Trees className="h-5 w-5" />,
                  resolveSection(reportData.formData, 'Land Use Mapping'),
                  '#059669'
                )}

                {renderDataSection(
                  'Water Resources',
                  <Droplets className="h-5 w-5" />,
                  resolveSection(reportData.formData, 'Water Resources'),
                  '#06b6d4'
                )}
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
                Generated on {new Date().toLocaleString()} • GP Yojana Dashboard
              </div>
            </div>
          </ScrollArea>
        ) : (
          <Card className="p-8">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No data available for the selected year. Please select a different year or submit data first.
              </AlertDescription>
            </Alert>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Reports;