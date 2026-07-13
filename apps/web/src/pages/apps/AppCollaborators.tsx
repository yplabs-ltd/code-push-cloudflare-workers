import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

interface CollaboratorEntry {
  accountId?: string;
  permission?: "Owner" | "Collaborator";
  isCurrentAccount?: boolean;
}

function alertError(error: unknown, fallback: string) {
  const data = (
    error as {
      response?: { data?: { message?: string; error?: string } };
    }
  )?.response?.data;
  window.alert(data?.message ?? data?.error ?? fallback);
}

export const AppCollaborators = ({ appName }: { appName: string }) => {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");

  const { data } = useQuery({
    queryKey: ["collaborators", appName],
    queryFn: async () => (await api.appsAppNameCollaboratorsGet(appName)).data,
  });

  const collaborators = (data?.collaborators ?? {}) as Record<
    string,
    CollaboratorEntry
  >;
  const entries = Object.entries(collaborators);
  const isOwner = entries.some(
    ([, c]) => c.isCurrentAccount && c.permission === "Owner",
  );
  const ownerCount = entries.filter(([, c]) => c.permission === "Owner").length;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["collaborators", appName] });

  const addMutation = useMutation({
    mutationFn: (email: string) =>
      api.appsAppNameCollaboratorsEmailPost(appName, email),
    onSuccess: () => {
      setNewEmail("");
      invalidate();
    },
    onError: (e) => alertError(e, "협업자 추가에 실패했습니다."),
  });

  const removeMutation = useMutation({
    mutationFn: (email: string) =>
      api.appsAppNameCollaboratorsEmailDelete(appName, email),
    onSuccess: invalidate,
    onError: (e) => alertError(e, "협업자 제거에 실패했습니다."),
  });

  const roleMutation = useMutation({
    mutationFn: ({
      email,
      permission,
    }: {
      email: string;
      permission: "Owner" | "Collaborator";
    }) => api.appsAppNameCollaboratorsEmailPatch(appName, email, { permission }),
    onSuccess: invalidate,
    onError: (e) => alertError(e, "권한 변경에 실패했습니다."),
  });

  const pending =
    addMutation.isPending || removeMutation.isPending || roleMutation.isPending;

  const onAdd = () => {
    const email = newEmail.trim();
    if (email) addMutation.mutate(email);
  };

  return (
    <div className="rounded-lg border">
      {isOwner && (
        <div className="flex items-center gap-2 border-b p-4">
          <Input
            type="email"
            placeholder="추가할 협업자 이메일"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={onAdd} disabled={pending || !newEmail.trim()}>
            추가
          </Button>
        </div>
      )}

      <div className="divide-y">
        {entries.map(([email, c]) => {
          const isLastOwner = c.permission === "Owner" && ownerCount <= 1;
          return (
            <div
              key={email}
              className="flex items-center justify-between gap-2 p-4"
            >
              <div className="min-w-0 truncate">
                <span className="font-medium">{email}</span>
                {c.isCurrentAccount && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (나)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isOwner ? (
                  <Select
                    value={c.permission}
                    onValueChange={(permission) =>
                      roleMutation.mutate({
                        email,
                        permission: permission as "Owner" | "Collaborator",
                      })
                    }
                    disabled={pending || isLastOwner}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Owner">Owner</SelectItem>
                      <SelectItem value="Collaborator">Collaborator</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant={
                      c.permission === "Owner" ? "default" : "secondary"
                    }
                  >
                    {c.permission}
                  </Badge>
                )}
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending || isLastOwner}
                    onClick={() => {
                      if (window.confirm(`${email} 협업자를 제거할까요?`)) {
                        removeMutation.mutate(email);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isOwner && (
        <p className="border-t p-3 text-xs text-muted-foreground">
          협업자 관리(추가·제거·권한 변경)는 Owner만 가능합니다.
        </p>
      )}
    </div>
  );
};
