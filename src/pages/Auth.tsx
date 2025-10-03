import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles, Shield, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
});

const signupSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username too long").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Invalid email address").max(255, "Email too long").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(50, "Display name too long").optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format (use E.164 format: +1234567890)").optional().or(z.literal("")),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      if (isLogin) {
        loginSchema.parse({ username, password });

        // Get email from username
        const { data: emailData, error: emailError } = await supabase.rpc(
          'get_email_by_username',
          { input_username: username.trim() }
        );

        if (emailError || !emailData) {
          toast({
            title: "Login failed",
            description: "Username not found. Please check your username.",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: emailData,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Login failed",
              description: "Invalid username or password. Please try again.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Welcome back!",
            description: "Successfully logged in.",
          });
          navigate("/");
        }
      } else {
        signupSchema.parse({ 
          username, 
          email, 
          password, 
          displayName, 
          phoneNumber: phoneNumber || undefined 
        });

        // Check if username already exists
        const { data: existingUsername } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username.trim())
          .single();

        if (existingUsername) {
          toast({
            title: "Username taken",
            description: "This username is already in use. Please choose another.",
            variant: "destructive",
          });
          return;
        }
        const redirectUrl = `${window.location.origin}/`;
        
        // Generate email if not provided (required by Supabase Auth)
        const userEmail = email.trim() || `${username.trim()}@nexora.internal`;
        
        const { data: authData, error } = await supabase.auth.signUp({
          email: userEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: displayName.trim() || username.trim(),
              username: username.trim(),
            },
          },
        });

        // Update profile with phone number if provided
        if (!error && authData.user && phoneNumber) {
          await supabase
            .from('profiles')
            .update({ phone_number: phoneNumber.trim() })
            .eq('user_id', authData.user.id);
        }

        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please login instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to Nexora. You can now start chatting.",
          });
          navigate("/");
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 aurora-bg" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />

      <Card className="w-full max-w-md p-8 bg-card/80 backdrop-blur-xl border-border/50 relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/src/assets/nexora-logo.png" alt="Nexora" className="h-16" />
          </div>
          <p className="text-lg text-primary font-semibold mb-2">
            Smarter Chats, Stronger Bonds.
          </p>
          <p className="text-muted-foreground text-sm">
            {isLogin ? "Welcome back" : "Join the intelligent messaging platform"}
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder={isLogin ? "Enter your username" : "Choose a username"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="bg-muted border-border"
              maxLength={30}
            />
            {!isLogin && (
              <p className="text-xs text-muted-foreground">
                Only letters, numbers, and underscores allowed
              </p>
            )}
          </div>

          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-muted border-border"
                  maxLength={255}
                />
                <p className="text-xs text-muted-foreground">
                  Email is optional - if not provided, a placeholder will be used
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name (optional)</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="How should we call you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-muted border-border"
                  maxLength={50}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number (optional)</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="bg-muted border-border"
                  maxLength={15}
                />
                <p className="text-xs text-muted-foreground">
                  Use international format with + (e.g., +1234567890)
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-muted border-border"
              minLength={8}
              maxLength={100}
            />
            {!isLogin && (
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary-glow"
            disabled={loading}
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {/* Toggle Login/Signup */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setEmail("");
              setDisplayName("");
              setPhoneNumber("");
            }}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>

        {/* Features */}
        <div className="mt-8 pt-6 border-t border-border space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-muted-foreground">End-to-end encrypted</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-muted-foreground">AI-powered assistance</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-muted-foreground">Real-time messaging</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
