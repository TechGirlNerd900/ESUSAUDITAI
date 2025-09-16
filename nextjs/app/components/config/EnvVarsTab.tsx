import React, { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { Loader2, Plus, Trash2, RefreshCw } from 'lucide-react';
import { ConfigCategory } from '@/lib/core/configManager';
import { useEnvVars } from '@/hooks/useEnvVars';
import { EnvVarForm } from './EnvVarForm';

export const EnvVarsTab: React.FC = () => {
  const { envVars, loading, error, loadEnvVars, saveEnvVar, deleteEnvVar } = useEnvVars();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  // Load environment variables on mount
  useEffect(() => {
    loadEnvVars(selectedCategory || undefined);
  }, [selectedCategory, loadEnvVars]);

  // Handle category change
  const handleCategoryChange = (value: string) => {
    const category = value || null;
    setSelectedCategory(category);
  };

  // Render category badge
  const renderCategoryBadge = (category: string) => {
    const categoryColors: Record<string, string> = {
      database: 'bg-blue-100 text-blue-800',
      google: 'bg-purple-100 text-purple-800',
      auth: 'bg-green-100 text-green-800',
      security: 'bg-red-100 text-red-800',
      monitoring: 'bg-yellow-100 text-yellow-800',
      custom: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={categoryColors[category] || 'bg-gray-100 text-gray-800'}>{category}</Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Select value={selectedCategory || ''} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {Object.values(ConfigCategory).map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => loadEnvVars(selectedCategory || undefined)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Variable
        </Button>
      </div>

      {/* Environment Variables Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="mt-2 text-sm text-gray-500">Loading environment variables...</p>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-sm text-red-500">Error: {error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadEnvVars(selectedCategory || undefined)}
                      className="mt-2"
                    >
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ) : envVars.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-sm text-gray-500">
                      No environment variables found
                      {selectedCategory && ` in category "${selectedCategory}"`}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                envVars.map((env) => (
                  <TableRow key={env.key}>
                    <TableCell className="font-mono">{env.key}</TableCell>
                    <TableCell className="font-mono">
                      {env.sensitive ? '********' : env.value}
                    </TableCell>
                    <TableCell>{renderCategoryBadge(env.category)}</TableCell>
                    <TableCell>{env.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteEnvVar(env.key)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Environment Variable Dialog */}
      <EnvVarForm open={showDialog} onOpenChange={setShowDialog} onSave={saveEnvVar} />
    </div>
  );
};
