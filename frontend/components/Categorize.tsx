import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { aptosClient } from "@/utils/aptosClient";
import { 
  FileText,
  Loader,
  AlertCircle,
  FolderOpen,
  Link2
} from 'lucide-react';
import axios from 'axios';

interface Document {
  id: number;
  content_hash: string;
  creator: string;
  signers: string[];
  signatures: string[];
  is_completed: boolean;
  category?: 'education' | 'personal identity' | 'legal' | 'financial' | 'medical' | 'work' | 'other';
}

interface CategoryGroup {
  [key: string]: Document[];
}

const STATUS_STYLES = {
  education: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    icon: 'text-blue-400',
  },
  'personal identity': {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    icon: 'text-purple-400',
  },
  legal: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    icon: 'text-emerald-400',
  },
  financial: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    icon: 'text-yellow-400',
  },
  medical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    icon: 'text-red-400',
  },
  work: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
    icon: 'text-orange-400',
  },
  other: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    text: 'text-gray-400',
    icon: 'text-gray-400',
  }
};

export default function DocumentCategories() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categorizedDocs, setCategorizedDocs] = useState<CategoryGroup>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const moduleAddress = import.meta.env.VITE_APP_MODULE_ADDRESS;
  const moduleName = import.meta.env.VITE_APP_MODULE_NAME;

  const API_KEY = "AIzaSyD6olpfeXKuZiACMF5awOE_HxOI4ifOlZM";

  // Fetch documents and categorize them
  useEffect(() => {
    fetchAndCategorizeDocuments();
  }, []);

  const fetchDocumentContent = async (cid: string) => {
    try {
      const url = `https://ipfs.io/ipfs/${cid}`;
      const response = await axios.get(url, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      console.error("Error fetching document content:", error);
      return null;
    }
  };

  const determineCategory = async (content: string, model: any): Promise<string> => {
    try {
      const categoryPrompt = `Based on the following text, determine the most appropriate document category. 
      Categories include: education, personal identity, legal, financial, medical, work, other.
      
      Text: ${content}
      
      Respond with ONLY the category name in lowercase.`;

      const categoryResult = await model.generateContent(categoryPrompt);
      const category = categoryResult.response.text().trim().toLowerCase();

      const validCategories = ['education', 'personal identity', 'legal', 'financial', 'medical', 'work', 'other'];
      return validCategories.includes(category) ? category : 'other';
    } catch (err) {
      console.error('Category determination error:', err);
      return 'other';
    }
  };

  const fetchAndCategorizeDocuments = async () => {
    setLoading(true);
    try {
      // Replace with your actual document fetching logic
      const response = await aptosClient().view<[Document]>({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_all_documents`,
          typeArguments: [],
          functionArguments: [],
        }
      });

      if (Array.isArray(response) && response.length > 0) {
        const docs = response[0];
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Process each document
        const categorizedResults = await Promise.all(
          docs.map(async (doc : any) => {
            try {
              const content = await fetchDocumentContent(doc.content_hash);
              if (content) {
                const category = await determineCategory(content, model);
                return { ...doc, category };
              }
              return { ...doc, category: 'other' };
            } catch (error) {
              console.error(`Error processing document ${doc.id}:`, error);
              return { ...doc, category: 'other' };
            }
          })
        );

        // Group by category
        const grouped = categorizedResults.reduce((acc : any, doc:any) => {
          const category = doc.category || 'other';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(doc);
          return acc;
        }, {} as CategoryGroup);

        setDocuments(categorizedResults);
        setCategorizedDocs(grouped);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const openIPFSFile = async(cid: string) => {
    const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
    window.open(ipfsUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1B1E] flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 animate-pulse">Categorizing documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1B1E] text-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-8 flex items-center space-x-3">
        <FolderOpen className="w-8 h-8 text-emerald-400" />
        <span>Document Categories</span>
      </h1>

      {error ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(categorizedDocs).map(([category, docs]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-xl font-semibold capitalize flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${STATUS_STYLES[category].bg}`} />
                <span>{category} Documents</span>
                <span className="text-sm text-gray-400">({docs.length})</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {docs.map((doc) => {
                  const styles = STATUS_STYLES[doc.category || 'other'];
                  return (
                    <div 
                      key={doc.id}
                      className={`group relative bg-gray-800/50 backdrop-blur-sm rounded-xl border ${styles.border} hover:shadow-lg transition-all duration-200`}
                    >
                      <div className={`absolute top-0 left-4 right-0 h-2 ${styles.bg} rounded-b-lg`} />
                      
                      <div className="p-4 md:p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-10 h-10 rounded-lg ${styles.bg} flex items-center justify-center`}>
                            <FileText className={`w-5 h-5 ${styles.icon}`} />
                          </div>
                          <button
                            onClick={() => openIPFSFile(doc.content_hash)}
                            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <h3 className="font-medium">Document {doc.id}</h3>
                          <p className="text-sm text-gray-400">
                            {doc.signatures.length} of {doc.signers.length} signatures
                          </p>
                          <div className={`text-xs ${styles.text}`}>
                            {doc.is_completed ? 'Completed' : 'Pending'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}