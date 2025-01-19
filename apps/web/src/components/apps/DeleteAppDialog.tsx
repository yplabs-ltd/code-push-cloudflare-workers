import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

interface DeleteAppDialogProps {
  app: {
    id: string;
    name: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteAppDialog = ({ app, open, onOpenChange }: DeleteAppDialogProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.managementAppsAppNameDelete(app.name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      navigate({ to: "/" });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete App</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{app.name}</strong>? This action
            cannot be undone and will delete all associated deployments and releases.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete App"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
