import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format (e.g., 1.0.0)"),
  description: z.string().optional(),
  isMandatory: z.boolean().default(false),
  isDisabled: z.boolean().default(false),
  rollout: z.number().min(0).max(100).optional(),
});

interface ReleaseDialogProps {
  appName: string;
  deploymentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReleaseDialog = ({
  appName,
  deploymentName,
  open,
  onOpenChange,
}: ReleaseDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      isMandatory: false,
      isDisabled: false,
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!selectedFile) throw new Error("No file selected");

      const formData = new FormData();
      formData.append("package", selectedFile);
      formData.append("packageInfo", JSON.stringify(values));

      const response = await api.managementAppsAppNameDeploymentsDeploymentNameReleasePost(
        appName,
        deploymentName,
        selectedFile,
        JSON.stringify(values)
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["deployment", appName, deploymentName]
      });
      onOpenChange(false);
      form.reset();
      setSelectedFile(null);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    releaseMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Release Update</DialogTitle>
          <DialogDescription>
            Release a new update to {deploymentName} deployment
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormItem>
                <FormLabel>Package</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedFile(file);
                    }}
                    accept=".zip"
                  />
                </FormControl>
                <FormDescription>
                  Upload your update package (ZIP file)
                </FormDescription>
              </FormItem>

              <FormField
                control={form.control}
                name="appVersion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App Version</FormLabel>
                    <FormControl>
                      <Input placeholder="1.0.0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Target binary version (semver)
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Release Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description of changes in this release"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rollout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rollout Percentage</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="100"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Percentage of users who will receive this update
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isMandatory"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Mandatory Update
                      </FormLabel>
                      <FormDescription>
                        Force users to install this update
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isDisabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Disabled
                      </FormLabel>
                      <FormDescription>
                        Prevent this release from being downloaded
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={!selectedFile || releaseMutation.isPending}
              >
                {releaseMutation.isPending ? "Releasing..." : "Release"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
