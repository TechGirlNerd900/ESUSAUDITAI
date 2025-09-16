import { createClient } from '@supabase/supabase-js';
import { DatabaseError } from '@/lib/errorHandler';

interface TransactionOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  rollbackPerformed?: boolean;
}

/**
 * Transaction Handler for Supabase Database Operations
 * Provides atomic transaction support for multi-step operations
 */
export class TransactionHandler {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  /**
   * Execute operations within a database transaction
   * @param operations Function containing database operations
   * @param options Transaction configuration options
   * @returns Promise with transaction result
   */
  async executeTransaction<T>(
    operations: (client: ReturnType<typeof createClient>) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const { maxRetries = 3, retryDelay = 1000, timeout = 30000 } = options;

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        // Create transaction-specific client
        const transactionClient = this.supabase;

        // Use RPC call to begin transaction
        const { error: beginError } = await transactionClient.rpc('begin_transaction');
        if (beginError) {
          throw new DatabaseError('begin_transaction', beginError.message);
        }

        let result: T;
        let rollbackPerformed = false;

        try {
          // Execute operations with timeout
          const operationPromise = operations(transactionClient);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Transaction timeout')), timeout);
          });

          result = await Promise.race([operationPromise, timeoutPromise]);

          // Commit transaction on success
          const { error: commitError } = await transactionClient.rpc('commit_transaction');
          if (commitError) {
            throw new DatabaseError('commit_transaction', commitError.message);
          }

          return {
            success: true,
            data: result,
            rollbackPerformed,
          };
        } catch (operationError) {
          // Rollback transaction on failure
          try {
            const { error: rollbackError } = await transactionClient.rpc('rollback_transaction');
            if (rollbackError) {
              console.error('Rollback failed:', rollbackError);
            } else {
              rollbackPerformed = true;
            }
          } catch (rollbackException) {
            console.error('Rollback exception:', rollbackException);
          }

          throw operationError;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain error types
        if (
          lastError.message.includes('duplicate key value') ||
          lastError.message.includes('violates foreign key') ||
          lastError.message.includes('violates check constraint')
        ) {
          break;
        }

        attempt++;

        if (attempt < maxRetries) {
          console.warn(
            `Transaction attempt ${attempt} failed, retrying in ${retryDelay}ms:`,
            lastError.message
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    return {
      success: false,
      error: lastError || new Error('Transaction failed after maximum retries'),
      rollbackPerformed: true,
    };
  }

  /**
   * Execute multiple operations in a single transaction
   * @param operations Array of database operations
   * @param options Transaction configuration options
   * @returns Promise with transaction result
   */
  async executeMultipleOperations<T>(
    operations: Array<(client: ReturnType<typeof createClient>) => Promise<any>>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T[]>> {
    return this.executeTransaction(async (client) => {
      const results: any[] = [];

      for (const operation of operations) {
        const result = await operation(client);
        results.push(result);
      }

      return results;
    }, options);
  }

  /**
   * Create organization with admin user atomically
   * @param organizationData Organization information
   * @param adminData Admin user information
   * @returns Promise with transaction result
   */
  async createOrganizationWithAdmin(
    organizationData: { name: string },
    adminData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }
  ): Promise<TransactionResult<{ organization: any; user: any; profile: any }>> {
    return this.executeTransaction(async (client) => {
      // 1. Create organization
      const { data: organization, error: orgError } = await client
        .from('organizations')
        .insert([{ name: organizationData.name.trim() }] as any)
        .select()
        .single();

      if (orgError) {
        throw new DatabaseError('organization_creation', orgError.message);
      }

      // 2. Create auth user
      const { data: authUser, error: authError } = await client.auth.signUp({
        email: adminData.email.toLowerCase().trim(),
        password: adminData.password,
        options: {
          data: {
            first_name: adminData.firstName,
            last_name: adminData.lastName,
            organization_id: (organization as any).id,
            role: 'admin',
          },
        },
      });

      if (authError) {
        throw new DatabaseError('auth_user_creation', authError.message);
      }

      // 3. Create user profile
      interface UserProfile {
        id: string;
        auth_user_id: string;
        organization_id: string;
        email: string;
        first_name: string;
        last_name: string;
        role: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }
      const { data: userProfile, error: profileError }: { data: UserProfile | null; error: any } = await client
        .from('users')
        .insert([
          {
            auth_user_id: authUser.user!.id,
            organization_id: (organization as any).id,
            email: adminData.email.toLowerCase().trim(),
            first_name: adminData.firstName.trim(),
            last_name: adminData.lastName.trim(),
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ] as any)
        .select()
        .single();

      if (profileError) {
        throw new DatabaseError('profile_creation', profileError.message);
      }

      // 4. Create audit log
      if (!userProfile || !userProfile.id || userProfile.id === '00000000-0000-0000-0000-000000000000') {
        throw new DatabaseError('audit_log_creation', 'Invalid user profile id for audit log');
      }
      await client.from('audit_logs').insert([
        {
          organization_id: (organization as any).id,
          user_id: (userProfile as any).id,
          action: 'organization_created',
          resource_type: 'organization',
          resource_id: (organization as any).id,
          details: {
            organization_name: (organization as any).name,
            admin_email: adminData.email,
            admin_name: `${adminData.firstName} ${adminData.lastName}`,
          },
          created_at: new Date().toISOString(),
        },
      ] as any);

      return {
        organization,
        user: authUser.user,
        profile: userProfile,
      };
    });
  }

  /**
   * Upload document with database record atomically
   * @param fileData File information
   * @param documentData Document metadata
   * @returns Promise with transaction result
   */
  async uploadDocumentWithRecord(
    fileData: { path: string; file: File },
    documentData: {
      name: string;
      organizationId: string;
      userId: string;
      projectId?: string;
      description?: string;
    }
  ): Promise<TransactionResult<{ document: any; uploadResult: any }>> {
    return this.executeTransaction(async (client) => {
      // 1. Upload file to storage
      const { data: uploadResult, error: uploadError } = await client.storage
        .from('documents')
        .upload(fileData.path, fileData.file);

      if (uploadError) {
        throw new DatabaseError('file_upload', uploadError.message);
      }

      // 2. Create document record
      const { data: document, error: dbError } = await client
        .from('documents')
        .insert([
          {
            name: documentData.name,
            file_path: fileData.path,
            organization_id: documentData.organizationId,
            uploaded_by: documentData.userId,
            project_id: documentData.projectId,
            description: documentData.description,
            status: 'uploaded',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ] as any)
        .select()
        .single();

      if (dbError) {
        throw new DatabaseError('document_creation', dbError.message);
      }

      // 3. Create audit log
      await client.from('audit_logs').insert([
        {
          organization_id: documentData.organizationId,
          user_id: documentData.userId,
          action: 'document_uploaded',
          resource_type: 'document',
          resource_id: (document as any).id,
          details: {
            document_name: (document as any).name,
            file_path: fileData.path,
            project_id: documentData.projectId,
          },
          created_at: new Date().toISOString(),
        },
      ] as any);

      return {
        document,
        uploadResult,
      };
    });
  }

  /**
   * Process document analysis atomically
   * @param documentId Document ID
   * @param analysisData Analysis results
   * @param userId User performing analysis
   * @returns Promise with transaction result
   */
  async processDocumentAnalysis(
    documentId: string,
    analysisData: {
      content: string;
      summary: string;
      key_findings: any[];
      recommendations: any[];
    },
    userId: string
  ): Promise<TransactionResult<{ document: any; analysis: any }>> {
    return this.executeTransaction(async (client) => {
      // 1. Update document status to processing
      const { data: document, error: statusError } = await (client as any)
        .from('documents')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .select()
        .single();

      if (statusError) {
        throw new DatabaseError('document_status_update', statusError.message);
      }

      // 2. Create analysis results
      const { data: analysis, error: analysisError } = await client
        .from('analysis_results')
        .insert([
          {
            document_id: documentId,
            content: analysisData.content,
            summary: analysisData.summary,
            key_findings: analysisData.key_findings,
            recommendations: analysisData.recommendations,
            analyzed_by: userId,
            created_at: new Date().toISOString(),
          },
        ] as any)
        .select()
        .single();

      if (analysisError) {
        throw new DatabaseError('analysis_creation', analysisError.message);
      }

      // 3. Update document status to analyzed
      const { error: finalStatusError } = await (client as any)
        .from('documents')
        .update({
          status: 'analyzed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (finalStatusError) {
        throw new DatabaseError('document_final_status', finalStatusError.message);
      }

      // 4. Create audit log
      await client.from('audit_logs').insert([
        {
          organization_id: document.organization_id,
          user_id: userId,
          action: 'document_analyzed',
          resource_type: 'document',
          resource_id: documentId,
          details: {
            document_name: (document as any).name,
            analysis_id: (analysis as any).id,
            findings_count: analysisData.key_findings.length,
            recommendations_count: analysisData.recommendations.length,
          },
          created_at: new Date().toISOString(),
        },
      ] as any);

      return {
        document,
        analysis,
      };
    });
  }
}

// Export singleton instance
export const transactionHandler = new TransactionHandler();
