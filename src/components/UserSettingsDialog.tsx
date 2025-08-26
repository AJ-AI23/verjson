import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Mail, Key, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const { user, updatePassword, updateEmail } = useAuth();
  const { profile, updateProfile, loading } = useUserProfile();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form fields when profile loads
  React.useEffect(() => {
    if (profile) {
      setNewUsername(profile.username || '');
      setNewFullName(profile.full_name || '');
    }
  }, [profile]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const success = await updateProfile({
        username: newUsername,
        full_name: newFullName,
      });

      if (success) {
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
        });
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setError(error.message);
      } else {
        toast({
          title: "Password updated",
          description: "Your password has been updated successfully.",
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newEmail || newEmail === user?.email) {
      setError('Please enter a new email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await updateEmail(newEmail);
      if (error) {
        setError(error.message);
      } else {
        toast({
          title: "Verification email sent",
          description: "Please check your new email for a verification link.",
        });
        setNewEmail('');
        onOpenChange(false);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Settings
          </DialogTitle>
          <DialogDescription>
            Update your profile, password, or email address.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="password" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Password
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting || (!newUsername && !newFullName)}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Profile...
                    </>
                  ) : (
                    'Update Profile'
                  )}
                </Button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || !newPassword || !confirmPassword}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <div className="space-y-2">
              <Label>Current Email</Label>
              <Input 
                value={user?.email || ''} 
                disabled 
                className="bg-muted"
              />
            </div>
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">New Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="Enter new email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || !newEmail}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Verification...
                  </>
                ) : (
                  'Send Verification Email'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}