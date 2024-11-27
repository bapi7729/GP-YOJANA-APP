import React from 'react';
import Document, { Html, Head, Main, NextScript, DocumentProps, DocumentContext } from 'next/document';
import createEmotionServer from '@emotion/server/create-instance';
import createEmotionCache from '../utils/createEmotionCache';
import Script from 'next/script';

class MyDocument extends Document<DocumentProps> {
  render() {
    return (
      <Html lang="en">
        <Head>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
          />
        </Head>
        <body>
          <div id="google_translate_element"></div>
          <Main />
          <NextScript />
          <Script
            id="google-translate-config"
            strategy="beforeInteractive"
            src="/assets/lang-config.js"
          />
          <Script
            id="google-translate-init"
            strategy="beforeInteractive"
            src="/assets/translation.js"
          />
          <Script
            id="google-translate-api"
            strategy="afterInteractive"
            src="//translate.google.com/translate_a/element.js?cb=TranslateInit"
          />
        </body>
      </Html>
    );
  }
}

export default MyDocument;