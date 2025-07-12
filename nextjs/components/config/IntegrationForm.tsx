import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IntegrationType } from '@/lib/configManager';
import { ApiIntegration } from '@/hooks/useIntegrations';

const DEFAULT_FORM_DATA: Partial<ApiIntegration> = {
  id: '',
  name: '',
  type: 'azure_openai',
  endpoint: '',
  api_key: '',
  config: {},
  enabled: true,
};

interface IntegrationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (integration: Partial<ApiIntegration>) => Promise<boolean>;
  initialData?: Partial<ApiIntegration>;
  title?: string;
  description?: string;
}

export const IntegrationForm: React.FC<IntegrationFormProps> = ({
  open,
  onOpenChange,
  onSave,
  initialData,
  title = 'Add API Integration',
  description = 'Add a new API integration to your organization.',
}) => {
  const [formData, setFormData] = useState<Partial<ApiIntegration>>(
    initialData || DEFAULT_FORM_DATA
  );
  const [configText, setConfigText] = useState('{}');
  const [saving, setSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const resetForm = (data?: Partial<ApiIntegration>) => {
    const formData = data || DEFAULT_FORM_DATA;
    setFormData(formData);
    setConfigText(JSON.stringify(formData.config || {}, null, 2));
    setConfigError(null);
  };

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      resetForm(initialData);
    }
  }, [open, initialData]);

  const handleConfigChange = (value: string) => {
    setConfigText(value);
    setConfigError(null);

    try {
      const config = JSON.parse(value);
      setFormData({ ...formData, config });
    } catch (error) {
      setConfigError('Invalid JSON format');
    }
  };

  const handleSave = async () => {
    if (configError) {
      return;
    }

    setSaving(true);
    try {
      const success = await onSave(formData);
      if (success) {
        resetForm();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    resetForm(initialData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="id" className="text-right">
              ID
            </label>
            <Input
              id="id"
              value={formData.id}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, id: e.target.value })
              }
              className="col-span-3"
              placeholder="unique-integration-id"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="name" className="text-right">
              Name
            </label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="col-span-3"
              placeholder="Integration Name"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="type" className="text-right">
              Type
            </label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
              disabled={saving}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(IntegrationType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="endpoint" className="text-right">
              Endpoint
            </label>
            <Input
              id="endpoint"
              value={formData.endpoint}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, endpoint: e.target.value })
              }
              className="col-span-3"
              placeholder="https://api.example.com"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="api_key" className="text-right">
              API Key
            </label>
            <Input
              id="api_key"
              value={formData.api_key}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, api_key: e.target.value })
              }
              className="col-span-3"
              type="password"
              placeholder="API Key"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <label htmlFor="config" className="text-right pt-2">
              Config (JSON)
            </label>
            <div className="col-span-3 space-y-2">
              <Textarea
                id="config"
                value={configText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  handleConfigChange(e.target.value)
                }
                className="font-mono text-sm"
                placeholder="{}"
                rows={5}
                disabled={saving}
              />
              {configError && <p className="text-sm text-red-500">{configError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="enabled" className="text-right">
              Enabled
            </label>
            <div className="flex items-center space-x-2 col-span-3">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                disabled={saving}
              />
              <label htmlFor="enabled" className="text-sm text-gray-500">
                Enable this integration for your organization
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !!configError}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
