import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

async function fetchConfigWithRetry(retries = 0): Promise<any> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data, error } = await supabase
      .from('config')
      .select('*')
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return fetchConfigWithRetry(retries + 1)
    }
    throw error
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const config = await fetchConfigWithRetry()
    res.status(200).json(config)
  } catch (error) {
    console.error('[Config API] Error fetching config:', error)
    res.status(500).json({ 
      error: 'Failed to fetch configuration',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}