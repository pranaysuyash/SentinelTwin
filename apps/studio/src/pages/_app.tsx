import type { AppProps } from "next/app";

export default function StudioPagesApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
