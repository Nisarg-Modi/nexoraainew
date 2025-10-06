import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Subscription {
  plan_type: string;
  started_at: string;
  expires_at: string | null;
}

const SubscriptionManagement = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const activatePremium = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_type: 'premium',
          started_at: new Date().toISOString(),
          expires_at: null, // No expiry for demo
        });

      if (error) throw error;

      toast({
        title: 'Premium activated!',
        description: 'You now have access to all premium features',
      });

      loadSubscription();
    } catch (error) {
      console.error('Error activating premium:', error);
      toast({
        title: 'Error',
        description: 'Failed to activate premium plan',
        variant: 'destructive',
      });
    }
  };

  const currentPlan = subscription?.plan_type || 'free';
  const isPremium = currentPlan === 'premium' || currentPlan === 'enterprise';

  const features = {
    free: [
      { name: 'Basic semantic search', available: true },
      { name: 'Up to 10 results per search', available: true },
      { name: 'Advanced filters', available: false },
      { name: 'Date range filters', available: false },
      { name: 'Sender filters', available: false },
      { name: 'Message type filters', available: false },
      { name: 'Enterprise team search', available: false },
    ],
    premium: [
      { name: 'Unlimited semantic search', available: true },
      { name: 'Unlimited results', available: true },
      { name: 'Advanced filters', available: true },
      { name: 'Date range filters', available: true },
      { name: 'Sender filters', available: true },
      { name: 'Message type filters', available: true },
      { name: 'Priority support', available: true },
    ],
  };

  if (loading) {
    return <div>Loading subscription details...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Your Plan
          </CardTitle>
          <CardDescription>
            Current plan: <Badge variant={isPremium ? 'default' : 'secondary'}>{currentPlan}</Badge>
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className={currentPlan === 'free' ? 'border-primary' : ''}>
          <CardHeader>
            <CardTitle>Free Plan</CardTitle>
            <CardDescription>Basic semantic search capabilities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {features.free.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  {feature.available ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={!feature.available ? 'text-muted-foreground' : ''}>
                    {feature.name}
                  </span>
                </li>
              ))}
            </ul>
            {currentPlan === 'free' && (
              <Badge variant="secondary">Current Plan</Badge>
            )}
          </CardContent>
        </Card>

        <Card className={isPremium ? 'border-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Premium Plan
            </CardTitle>
            <CardDescription>Advanced features and unlimited access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {features.premium.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{feature.name}</span>
                </li>
              ))}
            </ul>
            {isPremium ? (
              <Badge>Active</Badge>
            ) : (
              <Button onClick={activatePremium} className="w-full">
                Upgrade to Premium
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubscriptionManagement;
