'use client'

interface Props {
  results: any
  activeTab: string
  documentId: string
  projectId: string
}

export default function AnalysisResultsView({ results, activeTab }: Props) {
  if (!results) {
    return (
      <div className="text-center py-8 text-gray-500">
        No analysis results available
      </div>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold mb-4">Document Summary</h3>
            <p className="whitespace-pre-wrap">{results.summary}</p>
          </div>
        )
      case 'findings':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Key Findings</h3>
            {results.findings?.map((finding: any, index: number) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">{finding.title}</h4>
                <p className="text-gray-600">{finding.description}</p>
                {finding.severity && (
                  <span className={`inline-block mt-2 px-2 py-1 text-sm rounded ${
                    finding.severity === 'high' ? 'bg-red-100 text-red-700' :
                    finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1)} Severity
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      case 'recommendations':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Recommendations</h3>
            {results.recommendations?.map((rec: any, index: number) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">{rec.title}</h4>
                <p className="text-gray-600">{rec.description}</p>
                {rec.priority && (
                  <span className={`inline-block mt-2 px-2 py-1 text-sm rounded ${
                    rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} Priority
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {renderContent()}
    </div>
  )
}