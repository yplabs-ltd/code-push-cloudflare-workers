import { CreateAccessKeyDialog } from "@/components/settings/CreateAccessKeyDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Key } from "lucide-react";
import { useState } from "react";

export const SettingsPage = () => {
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: accountData } = useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      const response = await api.managementAccountGet();
      return response.data;
    },
  });

  const { data: keysData } = useQuery({
    queryKey: ["access-keys"],
    queryFn: async () => {
      const response = await api.managementAccessKeysGet();
      return response.data;
    },
  });

  const account = accountData?.account;
  const accessKeys = keysData?.accessKeys ?? [];

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and access keys
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Your account details and connected services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Name
              </div>
              <div>{account?.name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Email
              </div>
              <div>{account?.email}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Connected Services
              </div>
              <div className="flex gap-2 mt-1">
                {account?.linkedProviders.map((provider) => (
                  <Badge key={provider} variant="secondary">
                    {provider}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Access Keys</CardTitle>
              <CardDescription>
                Manage API access keys for your account
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateKeyOpen(true)}>
              <Key className="mr-2 h-4 w-4" />
              Create Access Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accessKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">
                    {key.friendlyName}
                  </TableCell>
                  <TableCell>{formatDate(key.createdTime)}</TableCell>
                  <TableCell>{formatDate(key.expires)}</TableCell>
                  <TableCell>{key.createdBy}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyKey(key.name)}
                    >
                      {copiedKey === key.name ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="sr-only">Copy key</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateAccessKeyDialog
        open={isCreateKeyOpen}
        onOpenChange={setIsCreateKeyOpen}
      />
    </div>
  );
};
