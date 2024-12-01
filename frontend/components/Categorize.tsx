import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { aptosClient } from '@/utils/aptosClient';
import { 
  FileText,
  Loader,
  AlertCircle,
  FolderOpen,
  Link2,
  Upload,
  File,
  X,
  ExternalLink,
  Clock,
  ArrowUpRight,
  Eye
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import axios from 'axios';

interface Document {
  id: number;
  content_hash: string;
  creator: string;
  signers: string[];
  signatures: string[];
  is_completed: boolean;
  category?: string;
  extractedContent?: string;
}

interface CategoryGroup {
  [key: string]: Document[];
}

const STATUS_STYLES = {
  'personal identity': {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    icon: 'text-purple-400',
    hover: 'hover:border-purple-500/50'
  },
  'legal': {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    icon: 'text-emerald-400',
    hover: 'hover:border-emerald-500/50'
  },
  'education': {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    icon: 'text-blue-400',
    hover: 'hover:border-blue-500/50'
  },
  'financial': {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    icon: 'text-yellow-400',
    hover: 'hover:border-yellow-500/50'
  },
  'medical': {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    icon: 'text-red-400',
    hover: 'hover:border-red-500/50'
  },
  'work': {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
    icon: 'text-orange-400',
    hover: 'hover:border-orange-500/50'
  },
  'other': {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    text: 'text-gray-400',
    icon: 'text-gray-400',
    hover: 'hover:border-gray-500/50'
  }
};

export default function DocumentCategories() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categorizedDocs, setCategorizedDocs] = useState<CategoryGroup>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  const API_KEY = "AIzaSyAcODqO3muGpih3AISgU4Dr7hZfFm3GWqU";
  const moduleAddress = process.env.VITE_APP_MODULE_ADDRESS;
  const moduleName = process.env.VITE_APP_MODULE_NAME;

  useEffect(() => {
    fetchAndCategorizeDocuments();
  }, []);

const processDocument = async (doc: Document, model: any): Promise<Document> => {
    try {
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${doc.content_hash}`, {
        responseType: 'blob'
      });
      const blob = response.data;
      const fileType = blob.type;
      
      // First, get Gemini to analyze the document content
      let extractedContent = '';
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      const base64Content = base64Data.split(',')[1];

      if (fileType.includes('image')) {
        // For images, have Gemini analyze the content
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { text: "Describe this image comprehensively. Extract all visible text, identify key objects, and provide a detailed description." },
              { inlineData: { mimeType: fileType, data: base64Content }}
            ]
          }]
        });
        extractedContent = result.response.text();
      } else if (fileType.includes('pdf') || fileType.includes('text')) {
        // For PDFs and text files
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { text: "Extract and summarize the main text content. Provide a comprehensive overview including key information, topics, and any significant details." },
              { inlineData: { mimeType: fileType, data: base64Content }}
            ]
          }]
        });
        extractedContent = result.response.text();
      }

      // Now determine the category based on the extracted content
      const categoryPrompt = `
        Based on this document content, determine the appropriate category:
        
        ${extractedContent}
        
        Categories:
        - personal identity (for ID documents like Aadhaar, PAN card, passport)
        - legal (for contracts, agreements, legal notices)
        - education (for certificates, marksheets, academic documents)
        - financial (for bank statements, invoices, financial records)
        - medical (for health records, prescriptions, medical reports)
        - work (for employment documents, offer letters)
        - other (if none of the above clearly match)

        Respond with ONLY the category name in lowercase.
      `;

      const categoryResult = await model.generateContent(categoryPrompt);
      const category = categoryResult.response.text().trim().toLowerCase();

      const validCategories = ['personal identity', 'legal', 'education', 'financial', 'medical', 'work', 'other'];
      return {
        ...doc,
        category: validCategories.includes(category) ? category : 'other',
        extractedContent
      };

    } catch (error) {
      console.error(`Error processing document ${doc.id}:`, error);
      return { ...doc, category: 'other' };
    }
  };

  const fetchAndCategorizeDocuments = async () => {
    setLoading(true);
    try {
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

        const categorizedResults = await Promise.all(
          docs.map(doc => processDocument(doc, model))
        );

        // Group by category
        const grouped = categorizedResults.reduce((acc, doc) => {
          const category = doc.category || 'other';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(doc);
          return acc;
        }, {} as CategoryGroup);

        setDocuments(categorizedResults);
        setCategorizedDocs(grouped);
        
        // Store for chat interface
        localStorage.setItem('processedDocuments', JSON.stringify(categorizedResults));

      } else {
        setDocuments([]);
        setCategorizedDocs({});
      }
    } catch (error) {
      console.error("Error fetching and categorizing documents:", error);
      setError('Failed to process documents');
    } finally {
      setLoading(false);
    }
  };

  const openIPFSFile = async(cid: string) => {
    const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
    window.open(ipfsUrl, '_blank');
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      setSelectedDoc(doc);
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${doc.content_hash}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      setViewUrl(url);
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error("Failed to load document");
    }
  };
}