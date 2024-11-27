import React from 'react';
import { AppProps } from 'next/app';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '../styles/theme';
import { LanguageProvider } from '../context/LanguageContext';
import Layout from '../components/Layout';
import '../styles/globals.css';
import { useRouter } from 'next/navigation';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const noLayoutPages = ['/signup', '/login']; // Add other pages that shouldn't have the layout
  const shouldUseLayout = !noLayoutPages.includes(router.pathname);

  React.useEffect(() => {
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles);
    }
  }, []);

  const content = shouldUseLayout ? (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  ) : (
    <Component {...pageProps} />
  );

  return (
    <LanguageProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {content}
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default MyApp;