import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Switch } from '@/app/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { ConfigCategory } from '@/lib/core/configManager';
import { EnvVar } from '@/hooks/useEnvVars';

interface EnvVarFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (envVar: Partial<EnvVar>) => Promise<boolean>;
  initialData?: Partial<EnvVar>;
  title?: string;
  description?: string;
}

export const EnvVarForm: React.FC<EnvVarFormProps> = ({
  open,
  onOpenChange,
  onSave,
  initialData,
  title = 'Add Environment Variable',
  description = 'Add a new environment variable to the application.',
}) => {
  const [formData, setFormData] = useState<Partial<EnvVar>>(
    initialData || {
      key: '',
      value: '',
      description: '',
      category: 'custom',
      sensitive: false,
    }
  );
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setFormData(
        initialData || {
          key: '',
          value: '',
          description: '',
          category: 'custom',
          sensitive: false,
        }
      );
    }
  }, [open, initialData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await onSave(formData);
      if (success) {
        // Reset form
        setFormData({
          key: '',
          value: '',
          description: '',
          category: 'custom',
          sensitive: false,
        });
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setFormData(
      initialData || {
        key: '',
        value: '',
        description: '',
        category: 'custom',
        sensitive: false,
      }
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="key" className="text-right">
              Key
            </label>
            <Input
              id="key"
              value={formData.key}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, key: e.target.value })
              }
              className="col-span-3"
              placeholder="APP_SETTING_NAME"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="value" className="text-right">
              Value
            </label>
            <Input
              id="value"
              value={formData.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, value: e.target.value })
              }
              className="col-span-3"
              type={formData.sensitive ? 'password' : 'text'}
              placeholder="Value"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="category" className="text-right">
              Category
            </label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
              disabled={saving}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ConfigCategory).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="description" className="text-right">
              Description
            </label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="col-span-3"
              placeholder="Description"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="sensitive" className="text-right">
              Sensitive
            </label>
            <div className="flex items-center space-x-2 col-span-3">
              <Switch
                id="sensitive"
                checked={formData.sensitive}
                onCheckedChange={(checked) => setFormData({ ...formData, sensitive: checked })}
                disabled={saving}
              />
              <label htmlFor="sensitive" className="text-sm text-gray-500">
                Mask this value in the UI and encrypt in the database
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
