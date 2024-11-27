import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { Container, Typography, Box, Grid, CircularProgress, Select, MenuItem, FormControl, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { app } from '../../lib/firebase';
import { useRouter } from 'next/router';
import ErrorBoundary from '@/components/ErrorBoundary';
import VulnerabilityOverview from '@/components/GPSnapshot/Vulnerability/VulnerabilityOverview';
import VulnerabilityDistribution from '@/components/GPSnapshot/Vulnerability/VulnerabilityDistribution';
import VulnerabilityStatistics from '@/components/GPSnapshot/Vulnerability/VulnerabilityStatistics';
// import { NavButton, VillageSelector } from '@/components/GPSnapshot/StyledComponents';

const NavButton = styled(Button)<{ active?: boolean }>(({ theme, active }) => ({
  color: 'white',
  backgroundColor: active ? theme.palette.grey[700] : theme.palette.grey[500],
  '&:hover': {
    backgroundColor: active ? theme.palette.grey[800] : theme.palette.grey[600],
  },
}));

const ChartContainer = styled(Box)(({ theme }) => ({
  height: '400px',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}));

const VillageSelector = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  '& .MuiFormControl-root': {
    minWidth: 200,
  },
}));

const PageSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(4),
}));

const VulnerabilitiesPage: React.FC = () => {
  const [vulnerabilityData, setVulnerabilityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<string>('All');
  const [gpName, setGpName] = useState<string>('');
  const [villages, setVillages] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          console.log("User authenticated:", user.uid);

          const dataCollectionsQuery = query(
            collection(db, 'dataCollections'),
            where('userId', '==', user.uid),
            orderBy('submittedAt', 'desc'),
            limit(1)
          );

          const querySnapshot = await getDocs(dataCollectionsQuery);
          if (!querySnapshot.empty) {
            const latestData = querySnapshot.docs[0].data();
            console.log("Latest data:", latestData);

            // Set Vulnerability Data
            if (latestData.formData?.Vulnerabilities) {
              console.log('Raw Vulnerability data from Firebase:', latestData.formData.Vulnerabilities);
              
              // Convert the data if it's an array
              if (Array.isArray(latestData.formData.Vulnerabilities)) {
                const processedData = latestData.formData.Vulnerabilities.reduce((acc, item) => {
                  if (item.village) {
                    acc[item.village] = {
                      kucchaHouses: item.kucchaHouses || 0,
                      elderlyMale: item.elderlyMale || 0,
                      elderlyFemale: item.elderlyFemale || 0,
                      disabledMale: item.disabledMale || 0,
                      disabledFemale: item.disabledFemale || 0,
                      widowCount: item.widowCount || 0,
                      orphanMale: item.orphanMale || 0,
                      orphanFemale: item.orphanFemale || 0,
                      samMale: item.samMale || 0,
                      samFemale: item.samFemale || 0,
                      mamMale: item.mamMale || 0,
                      mamFemale: item.mamFemale || 0,
                      noCleanWater: item.noCleanWater || 0,
                      singleMemberHouseholds: item.singleMemberHouseholds || 0,
                      landlessFarmers: item.landlessFarmers || 0,
                    };
                  }
                  return acc;
                }, {});
                console.log('Processed Vulnerability data:', processedData);
                setVulnerabilityData(processedData);
              } else {
                setVulnerabilityData(latestData.formData.Vulnerabilities);
              }
            }

            // Set Villages from Demographics
            if (latestData.formData?.Demographics) {
              const villageNames = Object.keys(latestData.formData.Demographics).filter(village => {
                const demographics = latestData.formData.Demographics[village];
                return demographics && demographics.totalPopulation && demographics.totalPopulation.trim() !== "";
              });
              console.log("Villages:", villageNames);
              setVillages(villageNames);
            }
          }

          // Fetch GP Name
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setGpName(userDoc.data().gpName || 'Unknown GP');
          }
        } catch (err) {
          console.error("Error fetching data:", err);
          setError("An error occurred while fetching data");
        } finally {
          setLoading(false);
        }
      } else {
        setError("Please log in to view the GP Snapshot");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return <Container maxWidth="xl"><Typography color="error">{error}</Typography></Container>;
  }

  return (
    <Container maxWidth="xl">
      <PageSection>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" gutterBottom>GP Snapshot - Vulnerabilities</Typography>
          <Typography variant="h2" fontWeight="bold">{gpName}</Typography>
        </Box>
      </PageSection>

      <ErrorBoundary>
        <PageSection>
          <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <NavButton 
                onClick={() => router.push('/gp-snapshot')} 
                sx={{ mr: 1 }}
              >
                Social
              </NavButton>
              <NavButton 
                onClick={() => router.push('/gp-snapshot/economic')} 
                sx={{ mr: 1 }}
              >
                Economic
              </NavButton>
              <NavButton 
                onClick={() => router.push('/gp-snapshot/environmental')}
                sx={{ mr: 1 }}
              >
                Environmental
              </NavButton>
              <NavButton 
                active={true}
              >
                Vulnerabilities
              </NavButton>
            </Box>
            <VillageSelector>
              <Typography variant="subtitle1" fontWeight="medium">
                Select Village:
              </Typography>
              <FormControl>
                <Select
                  value={selectedVillage}
                  onChange={(e) => setSelectedVillage(e.target.value as string)}
                  displayEmpty
                  sx={{ backgroundColor: 'white' }}
                >
                  <MenuItem value="All">All Villages</MenuItem>
                  {villages.map((village) => (
                    <MenuItem key={village} value={village}>{village}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </VillageSelector>
          </Box>
        </PageSection>

        <PageSection>
          <VulnerabilityStatistics 
            vulnerabilityData={vulnerabilityData} 
            selectedVillage={selectedVillage}
          />
        </PageSection>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <VulnerabilityDistribution 
              data={vulnerabilityData} 
              selectedVillage={selectedVillage} 
            />
          </Grid>
        </Grid>
      </ErrorBoundary>
    </Container>
  );
};

export default VulnerabilitiesPage; 