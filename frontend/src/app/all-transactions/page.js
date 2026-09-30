import { Suspense } from 'react';
import AllTransactionsClient from './AllTransactionsClient';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: '40px' }}>Loading...</div>}>
      <AllTransactionsClient />
    </Suspense>
  );
}