import { Wallet } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function WalletPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Your store"
      title="Wallet / Earnings"
      description="Track your balance, payouts, and earnings history."
      icon={Wallet}
    />
  );
}
