import { useState } from 'react';
import { fetchFrappeProjects } from '../services/frappeAPI';

export function TestFrappeConnection() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  const testConnection = async () => {
    try {
      setLoading(true);
      setResult('Testing connection...');
      setProjects([]);

      const data = await fetchFrappeProjects({}, 5);

      setResult(` SUCCESS! Found ${data.length} projects`);
      setProjects(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setResult(`FAILED: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Frappe API Connection Test</h2>

      <button
        onClick={testConnection}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
      >
        {loading ? 'Testing...' : 'Run Test'}
      </button>

      {result && (
        <div className={`mt-6 p-4 rounded-lg ${result.includes('')
            ? 'bg-green-50 border-2 border-green-200'
            : result.includes('')
              ? 'bg-red-50 border-2 border-red-200'
              : 'bg-blue-50 border-2 border-blue-200'
          }`}>
          <p className={`font-bold text-lg ${result.includes('')
              ? 'text-green-800'
              : result.includes('')
                ? 'text-red-800'
                : 'text-blue-800'
            }`}>
            {result}
          </p>
        </div>
      )}

      {projects.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold text-lg mb-3">Sample Projects:</h3>
          <div className="space-y-3">
            {projects.map((project, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded border">
                <p className="font-semibold">{project.title}</p>
                <p className="text-sm text-gray-600">{project.description}</p>
                <div className="mt-2 text-xs text-gray-500">
                  <span className="mr-4"> {project.subCounty}</span>
                  <span className="mr-4">KSH {project.budget?.toLocaleString()}</span>
                  <span>{project.financialYear}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TestFrappeConnection;