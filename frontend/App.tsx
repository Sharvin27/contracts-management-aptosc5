import { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { motion } from 'framer-motion';
import { FileText, Shield, Brain, FolderOpen, PenTool, Lock, Bot, ChevronDown, Share, Search } from 'lucide-react';
import { CardHeader, CardTitle } from "@/components/ui/card";
import { WalletSelector } from "./components/WalletSelector";
import ContractManagement from "@/components/ContractManagement";
import SigningDocument from "@/components/SigningDocument";
import ChatWithDocs from "@/components/ChatWithDocs";
import Categorize from "@/components/Categorize";
import SharedDocs from '@/components/SharedDocs';

const features = [
  {
    icon: <FileText className="w-8 h-8" />,
    title: "One-Click Drive Integration",
    description: "Seamlessly connect and manage your Google Drive files from a single dashboard",
  },
  {
    icon: <Shield className="w-8 h-8" />,
    title: "IPFS Storage",
    description: "Secure your documents with decentralized storage on IPFS",
  },
  {
    icon: <Brain className="w-8 h-8" />,
    title: "Talk2Doc AI Assistant",
    description: "Chat with your documents using advanced AI for instant insights",
  },
  {
    icon: <FolderOpen className="w-8 h-8" />,
    title: "Smart Categorization",
    description: "Auto-organize your files into intuitive categories",
  },
  {
    icon: <PenTool className="w-8 h-8" />,
    title: "Digital Signatures",
    description: "Sign documents securely with blockchain verification",
  },
  {
    icon: <Lock className="w-8 h-8" />,
    title: "Access Control",
    description: "Granular permissions and secure document sharing",
  },
  {
    icon: <Bot className="w-8 h-8" />,
    title: "On-Chain AI Agent",
    description: "Automate document workflows with blockchain-powered AI",
  }
];

function App() {
  const { connected } = useWallet();
  const [isHovering, setIsHovering] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col">      
      <main className="flex-grow">
        {connected ? (
          <Router>
            <Routes>
              <Route path="/" element={<ContractManagement />} />
              <Route path="/chatwithdocs" element={<ChatWithDocs />} />
              <Route path="/categorize" element={<Categorize />} />
              <Route path="/sign/:id" element={<SigningDocument />} />
            </Routes>
          </Router>
        ) : (
          <div className="flex items-center justify-center h-full">
            <CardHeader>
              <CardTitle>To get started Connect a wallet</CardTitle>
              <WalletSelector />
            </CardHeader>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;