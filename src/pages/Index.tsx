import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Sparkles, Globe, Zap, LogOut } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import ContactsList from "@/components/ContactsList";
import { useAuth } from "@/hooks/useAuth";
import nexoraLogo from "@/assets/nexora-logo.png";

const Index = () => {
  const [currentView, setCurrentView] = useState<'home' | 'contacts' | 'chat'>('contacts');
  const [selectedContact, setSelectedContact] = useState<{ userId: string; name: string } | null>(null);
  const { signOut, user } = useAuth();

  const handleStartChat = (contactUserId: string, contactName: string) => {
    setSelectedContact({ userId: contactUserId, name: contactName });
    setCurrentView('chat');
  };

  if (currentView === 'chat' && selectedContact) {
    return (
      <ChatInterface
        contactUserId={selectedContact.userId}
        contactName={selectedContact.name}
        onBack={() => {
          setCurrentView('contacts');
          setSelectedContact(null);
        }}
      />
    );
  }

  if (currentView === 'contacts') {
    return (
      <div className="min-h-screen bg-background relative">
        {/* Header with sign out */}
        <div className="sticky top-0 z-20 bg-card/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={nexoraLogo} alt="Nexora" className="h-8" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="hover:bg-primary/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
        <ContactsList onStartChat={handleStartChat} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Header with user info */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {user?.email}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="hover:bg-primary/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl aurora-bg" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl aurora-bg" style={{ animationDelay: "4s" }} />
      </div>

      {/* Hero Section */}
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto space-y-8 animate-slide-up">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={nexoraLogo} alt="Nexora" className="h-24 md:h-32" />
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="gradient-text">Nexora</span>
          </h1>
          <p className="text-2xl md:text-3xl text-primary font-light">
            Smarter chats, stronger bonds, brighter future.
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience intelligent communication with end-to-end encryption. AI-powered features that understand context, enhance conversations, and keep you connected.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              onClick={() => setCurrentView('contacts')}
              size="lg"
              className="bg-primary hover:bg-primary-glow text-primary-foreground shadow-lg glow-hover text-lg px-8 py-6"
            >
              <Sparkles className="mr-2 w-5 h-5" />
              Try Nexora AI
            </Button>
            <Button 
              variant="outline"
              size="lg"
              className="border-primary/30 hover:bg-primary/10 text-lg px-8 py-6"
            >
              Learn More
            </Button>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-4 justify-center pt-12">
            <FeaturePill icon={<Shield className="w-4 h-4" />} text="Post-Quantum E2EE" />
            <FeaturePill icon={<Sparkles className="w-4 h-4" />} text="AI Tone Shifting" />
            <FeaturePill icon={<Globe className="w-4 h-4" />} text="Live Translation" />
            <FeaturePill icon={<Zap className="w-4 h-4" />} text="Offline-First" />
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-6xl mx-auto">
          <FeatureCard
            icon={<Shield className="w-8 h-8 text-secondary" />}
            title="Zero-Knowledge Security"
            description="Military-grade encryption with post-quantum cryptography. Your data, your keys, your privacy."
          />
          <FeatureCard
            icon={<Sparkles className="w-8 h-8 text-primary" />}
            title="Nexora AI Assistant"
            description="Context-aware AI that drafts replies, shifts tone, and translates—all while preserving E2EE."
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8 text-accent" />}
            title="Lightning Fast"
            description="Optimized QUIC protocol delivers messages in <300ms. Works seamlessly offline."
          />
        </div>
      </div>
    </div>
  );
};

const FeaturePill = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-primary/20 text-sm">
    {icon}
    <span>{text}</span>
  </div>
);

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all duration-300 glow-hover">
    <div className="mb-4">{icon}</div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

export default Index;
