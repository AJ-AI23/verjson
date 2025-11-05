import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface UrlAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticate: (authMethod: 'basic' | 'bearer', credentials: string) => Promise<void>;
  url: string;
}

export function UrlAuthDialog({ open, onOpenChange, onAuthenticate, url }: UrlAuthDialogProps) {
  const [authMethod, setAuthMethod] = useState<'basic' | 'bearer'>('basic');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthenticate = async () => {
    setLoading(true);
    try {
      const credentials = authMethod === 'basic' ? `${username}:${password}` : token;
      await onAuthenticate(authMethod, credentials);
      onOpenChange(false);
      // Reset form
      setUsername('');
      setPassword('');
      setToken('');
    } catch (error) {
      console.error('Authentication failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Authentication Required</DialogTitle>
          <DialogDescription>
            The URL requires authentication. Please provide credentials to access:
            <br />
            <span className="font-mono text-xs break-all mt-2 block">{url}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="auth-method">Authentication Method</Label>
            <Select
              value={authMethod}
              onValueChange={(value) => setAuthMethod(value as 'basic' | 'bearer')}
            >
              <SelectTrigger id="auth-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic Authentication</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {authMethod === 'basic' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="token">Bearer Token</Label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter bearer token"
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleAuthenticate}
            disabled={
              loading ||
              (authMethod === 'basic' ? !username || !password : !token)
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Authenticate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
