import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Mail, ShieldCheck, Send } from 'lucide-react';
import {
  getStoreSettings,
  updatePaymentGateway,
  updateSmtpConfig,
  sendTestEmail,
} from '../../api/resellerSettings';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input, Label } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { Alert } from '../../components/ui/alert';

export default function PaymentsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: store, isLoading } = useQuery({ queryKey: ['reseller-settings'], queryFn: getStoreSettings });

  const [gatewayForm, setGatewayForm] = useState({ keyId: '', keySecret: '' });
  const [smtpForm, setSmtpForm] = useState({
    host: '',
    port: 587,
    user: '',
    password: '',
    fromName: '',
    fromEmail: '',
  });
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [gatewayMessage, setGatewayMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [smtpMessage, setSmtpMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [testMessage, setTestMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [savingGateway, setSavingGateway] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (!store) return;
    setGatewayForm({ keyId: store.paymentGateway.keyId ?? '', keySecret: '' });
    setSmtpForm({
      host: store.smtpConfig.host ?? '',
      port: store.smtpConfig.port ?? 587,
      user: store.smtpConfig.user ?? '',
      password: '',
      fromName: store.smtpConfig.fromName ?? '',
      fromEmail: store.smtpConfig.fromEmail ?? '',
    });
  }, [store]);

  const saveGateway = async (): Promise<void> => {
    setGatewayMessage(null);
    if (!gatewayForm.keyId) {
      setGatewayMessage({ tone: 'danger', text: 'Razorpay Key ID is required.' });
      return;
    }
    setSavingGateway(true);
    try {
      await updatePaymentGateway({
        provider: 'razorpay',
        keyId: gatewayForm.keyId,
        keySecret: gatewayForm.keySecret || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['reseller-settings'] });
      setGatewayForm((f) => ({ ...f, keySecret: '' }));
      setGatewayMessage({ tone: 'success', text: 'Razorpay credentials saved.' });
    } catch {
      setGatewayMessage({ tone: 'danger', text: 'Could not save gateway credentials.' });
    } finally {
      setSavingGateway(false);
    }
  };

  const saveSmtp = async (): Promise<void> => {
    setSmtpMessage(null);
    if (!smtpForm.host || !smtpForm.port) {
      setSmtpMessage({ tone: 'danger', text: 'SMTP host and port are required.' });
      return;
    }
    setSavingSmtp(true);
    try {
      await updateSmtpConfig({
        host: smtpForm.host,
        port: Number(smtpForm.port),
        user: smtpForm.user || undefined,
        password: smtpForm.password || undefined,
        fromName: smtpForm.fromName || undefined,
        fromEmail: smtpForm.fromEmail || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['reseller-settings'] });
      setSmtpForm((f) => ({ ...f, password: '' }));
      setSmtpMessage({ tone: 'success', text: 'SMTP settings saved.' });
    } catch {
      setSmtpMessage({ tone: 'danger', text: 'Could not save SMTP settings.' });
    } finally {
      setSavingSmtp(false);
    }
  };

  const sendTest = async (): Promise<void> => {
    setTestMessage(null);
    if (!testEmailAddress) {
      setTestMessage({ tone: 'danger', text: 'Enter an email address to send the test to.' });
      return;
    }
    setSendingTest(true);
    try {
      await sendTestEmail(testEmailAddress);
      setTestMessage({ tone: 'success', text: `Test email sent to ${testEmailAddress}.` });
    } catch {
      setTestMessage({ tone: 'danger', text: 'Could not send test email. Check your SMTP settings.' });
    } finally {
      setSendingTest(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Billing & mail"
        title="Payments & SMTP"
        description="Connect your own Razorpay account and email sender so checkout and notifications run under your brand."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" aria-hidden="true" />
            Razorpay (sandbox)
          </CardTitle>
          <CardDescription>
            Use your Razorpay test-mode keys for now. Checkout will fall back to a simulated gateway
            until keys are configured here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="rzp-key-id">Key ID</Label>
            <Input
              id="rzp-key-id"
              placeholder="rzp_test_xxxxxxxxxxxx"
              value={gatewayForm.keyId}
              onChange={(e) => setGatewayForm((f) => ({ ...f, keyId: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="rzp-key-secret">
              Key Secret {store?.paymentGateway.keySecretEncryptedSet && <span className="text-muted">(saved — leave blank to keep)</span>}
            </Label>
            <Input
              id="rzp-key-secret"
              type="password"
              placeholder={store?.paymentGateway.keySecretEncryptedSet ? '••••••••••••' : 'Key secret'}
              value={gatewayForm.keySecret}
              onChange={(e) => setGatewayForm((f) => ({ ...f, keySecret: e.target.value }))}
            />
          </div>
          {gatewayMessage && (
            <div className="md:col-span-2">
              <Alert tone={gatewayMessage.tone}>{gatewayMessage.text}</Alert>
            </div>
          )}
          <div className="md:col-span-2">
            <Button type="button" onClick={saveGateway} disabled={savingGateway}>
              <ShieldCheck aria-hidden="true" />
              {savingGateway ? 'Saving...' : 'Save gateway credentials'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" aria-hidden="true" />
            SMTP sender
          </CardTitle>
          <CardDescription>
            Emails to your customers (order confirmations, license keys, password resets) will send
            from this address instead of the platform default.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="smtp-host">SMTP host</Label>
            <Input
              id="smtp-host"
              placeholder="smtp.yourprovider.com"
              value={smtpForm.host}
              onChange={(e) => setSmtpForm((f) => ({ ...f, host: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="smtp-port">Port</Label>
            <Input
              id="smtp-port"
              type="number"
              value={smtpForm.port}
              onChange={(e) => setSmtpForm((f) => ({ ...f, port: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label htmlFor="smtp-user">Username</Label>
            <Input
              id="smtp-user"
              value={smtpForm.user}
              onChange={(e) => setSmtpForm((f) => ({ ...f, user: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="smtp-password">
              Password {store?.smtpConfig.passwordEncryptedSet && <span className="text-muted">(saved — leave blank to keep)</span>}
            </Label>
            <Input
              id="smtp-password"
              type="password"
              placeholder={store?.smtpConfig.passwordEncryptedSet ? '••••••••••••' : 'SMTP password'}
              value={smtpForm.password}
              onChange={(e) => setSmtpForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="smtp-from-name">From name</Label>
            <Input
              id="smtp-from-name"
              placeholder="Your Store"
              value={smtpForm.fromName}
              onChange={(e) => setSmtpForm((f) => ({ ...f, fromName: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="smtp-from-email">From email</Label>
            <Input
              id="smtp-from-email"
              type="email"
              placeholder="orders@yourstore.com"
              value={smtpForm.fromEmail}
              onChange={(e) => setSmtpForm((f) => ({ ...f, fromEmail: e.target.value }))}
            />
          </div>
          {smtpMessage && (
            <div className="md:col-span-2">
              <Alert tone={smtpMessage.tone}>{smtpMessage.text}</Alert>
            </div>
          )}
          <div className="md:col-span-2">
            <Button type="button" onClick={saveSmtp} disabled={savingSmtp}>
              <ShieldCheck aria-hidden="true" />
              {savingSmtp ? 'Saving...' : 'Save SMTP settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-4" aria-hidden="true" />
            Send a test email
          </CardTitle>
          <CardDescription>Confirm your SMTP settings work before going live.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="test-email">Send to</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="you@example.com"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" onClick={sendTest} disabled={sendingTest}>
            {sendingTest ? 'Sending...' : 'Send test email'}
          </Button>
        </CardContent>
        {testMessage && (
          <div className="px-5 pb-5">
            <Alert tone={testMessage.tone}>{testMessage.text}</Alert>
          </div>
        )}
      </Card>
    </div>
  );
}
