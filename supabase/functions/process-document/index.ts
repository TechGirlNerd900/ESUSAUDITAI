import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DocumentProcessRequest {
  document_id: string
  retry_count?: number
  max_retries?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { document_id, retry_count = 0, max_retries = 3 }: DocumentProcessRequest = await req.json()

    console.log(`Processing document ${document_id}, attempt ${retry_count + 1}`)

    // Update document status to processing
    await supabase
      .from('documents')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', document_id)

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`)
    }

    // Simulate AI processing with retry logic
    const startTime = Date.now()
    
    try {
      // Call your AI service here (OpenAI, Azure, etc.)
      const aiResult = await processWithAI(document)
      
      const processingTime = Date.now() - startTime

      // Store analysis results
      const { error: analysisError } = await supabase
        .from('analysis_results')
        .insert([{
          document_id,
          extracted_data: aiResult.extractedData,
          ai_summary: aiResult.summary,
          red_flags: aiResult.redFlags,
          highlights: aiResult.highlights,
          confidence_score: aiResult.confidence,
          processing_time_ms: processingTime,
          organization_id: document.organization_id
        }])

      if (analysisError) {
        throw new Error(`Failed to save analysis: ${analysisError.message}`)
      }

      // Update document status to analyzed
      await supabase
        .from('documents')
        .update({ 
          status: 'analyzed',
          updated_at: new Date().toISOString()
        })
        .eq('id', document_id)

      // Create audit log
      await supabase
        .from('audit_logs')
        .insert([{
          user_id: document.uploaded_by,
          action: 'document_processed',
          resource_type: 'document',
          resource_id: document_id,
          details: {
            processing_time_ms: processingTime,
            confidence_score: aiResult.confidence,
            retry_count
          },
          organization_id: document.organization_id
        }])

      return new Response(
        JSON.stringify({ 
          success: true, 
          processing_time_ms: processingTime,
          confidence_score: aiResult.confidence 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (aiError) {
      console.error(`AI processing failed:`, aiError)

      // Implement retry logic
      if (retry_count < max_retries) {
        console.log(`Retrying document ${document_id}, attempt ${retry_count + 2}`)
        
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, retry_count) * 1000 // 1s, 2s, 4s...
        
        setTimeout(async () => {
          const retryResponse = await fetch(req.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              document_id,
              retry_count: retry_count + 1,
              max_retries
            })
          })
        }, delay)

        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Processing failed, retrying...',
            retry_count: retry_count + 1
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // Max retries reached, mark as error
        await supabase
          .from('documents')
          .update({ 
            status: 'error',
            updated_at: new Date().toISOString()
          })
          .eq('id', document_id)

        // Log the failure
        await supabase
          .from('audit_logs')
          .insert([{
            user_id: document.uploaded_by,
            action: 'document_processing_failed',
            resource_type: 'document',
            resource_id: document_id,
            details: {
              error: aiError.message,
              retry_count,
              max_retries
            },
            success: false,
            error_message: aiError.message,
            organization_id: document.organization_id
          }])

        throw aiError
      }
    }

  } catch (error) {
    console.error('Document processing error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
async function processWithAI(document: any) {
  try {
    // Create Supabase client for invoking edge functions
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call the smart-task edge function
    const { data, error } = await supabase.functions.invoke('smart-task', {
      body: { 
        document: {
          id: document.id,
          name: document.original_name,
          file_path: document.file_path,
          file_type: document.file_type,
          file_size: document.file_size
        },
        task_type: 'document_analysis',
        options: {
          extract_entities: true,
          detect_red_flags: true,
          generate_summary: true,
          confidence_threshold: 0.7
        }
      }
    })

    if (error) {
      console.error('Smart-task function error:', error)
      throw new Error(`Smart-task processing failed: ${error.message}`)
    }

    if (!data || !data.success) {
      throw new Error(`Smart-task returned unsuccessful result: ${data?.error || 'Unknown error'}`)
    }

    // Return standardized format expected by the calling function
    return {
      extractedData: data.extracted_data || {
        documentType: data.document_type || 'unknown',
        entities: data.entities || [],
        amounts: data.amounts || []
      },
      summary: data.summary || `Analysis of ${document.original_name}: Processing completed.`,
      redFlags: data.red_flags || [],
      highlights: data.highlights || [],
      confidence: data.confidence_score || 0.5
    }

  } catch (error) {
    console.error('AI processing error:', error)
    
    // Fallback to basic processing if smart-task fails
    return {
      extractedData: {
        documentType: 'unknown',
        entities: [],
        amounts: []
      },
      summary: `Analysis of ${document.original_name}: Basic processing completed (AI service unavailable).`,
      redFlags: ['AI analysis unavailable - manual review recommended'],
      highlights: ['Document uploaded successfully'],
      confidence: 0.3
    }
  }
}