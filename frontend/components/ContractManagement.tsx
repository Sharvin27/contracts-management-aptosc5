import React, { useState, useEffect } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { aptosClient } from "@/utils/aptosClient";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import axios from 'axios';
import { Modal, Button, Upload, message, Input, Tabs } from 'antd';
import { UploadOutlined, ShareAltOutlined } from '@ant-design/icons';
import { WalletSelector } from "./WalletSelector";
import { useNavigate } from 'react-router-dom';
import { TiDocumentAdd } from "react-icons/ti";

const { TabPane } = Tabs;

interface Signature {
  signer: string;
  timestamp: string;
}

interface Document {
  id: number;
  content_hash: string;
  creator: string;
  signers: string[];
  signatures: Signature[];
  is_completed: boolean;
}

export const ContractManagement: React.FC = () => {
    const { account, signAndSubmitTransaction } = useWallet();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [pendingDocuments, setPendingDocuments] = useState<Document[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [signers, setSigners] = useState("");
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const [viewDocumentUrl, setViewDocumentUrl] = useState<string | null>(null);
    const moduleAddress = process.env.VITE_APP_MODULE_ADDRESS;
    const moduleName = process.env.VITE_APP_MODULE_NAME
    const navigate = useNavigate();

    useEffect(() => {
    if (account) {
      fetchDocuments();
      fetchPendingDocuments();
    }
  }, [account]);

  const fetchDocuments = async () => {
    if (!account) return;
    try {
        const response = await aptosClient().view<[Document]>({
            payload: {
                function: `${moduleAddress}::${moduleName}::get_all_documents`,
                typeArguments: [],
                functionArguments: [],
            }
          });
          if (Array.isArray(response) && response.length > 0) {
            console.log("All documents:", response[0]);
            const userDocuments = response[0].filter(
              doc => doc.creator === account.address
            );
            console.log("User documents:", userDocuments);
            setDocuments(userDocuments);
          } else {
            console.log("No documents found or unexpected response format");
            setDocuments([]);
          }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  const fetchPendingDocuments = async () => {
    if (!account) return;
    try {
      const response = await aptosClient().view<Document[]>({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_all_documents`,
          typeArguments: [],
          functionArguments: [],
        }
      });

      if (Array.isArray(response) && response.length > 0) {
        console.log("All documents:", response[0]);
        const pendingDocs = response[0].filter(doc => 
          doc.signers.includes(account.address) && 
          !doc.signatures.some(sig => sig.signer === account.address) &&
          !doc.is_completed
        );
        console.log("Pending documents:", pendingDocs);
        setPendingDocuments(pendingDocs);
      } else {
        console.log("No pending documents found or unexpected response format");
        setPendingDocuments([]);
      }
    } catch (error) {
      console.error("Error fetching pending documents:", error);
      message.error("Failed to fetch pending documents. Please try again.");
    }
  };

  const uploadToPinata = async (file: File) => {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

    // Create form data
    let formData = new FormData();
    formData.append('file', file);
    const metadata = JSON.stringify({
        name: 'Property Image',
    });
    formData.append('pinataMetadata', metadata);
    const options = JSON.stringify({
        cidVersion: 0,
    })
    formData.append('pinataOptions', options);

    try {
        const res = await axios.post(url, formData, {
            method: "post",
            data: formData,
            headers: {
                'pinata_api_key': process.env.VITE_APP_PINATA_API_KEY,
                'pinata_secret_api_key': process.env.VITE_APP_PINATA_SECRET_API_KEY,
                "Content-Type": "multipart/form-data"
            },
            });
      return res.data.IpfsHash;
    } catch (error) {
      console.error("Error uploading to Pinata:", error);
      throw error;
    }
  };

  const handleCreateDocument = async () => {
    if (!account || !file || !signers) return;
    setTransactionInProgress(true);
    try {
      const cid = await uploadToPinata(file);
      const signerAddresses = signers.split(',').map(addr => addr.trim());
      const payload: InputTransactionData = {
        data: {
          function: `${moduleAddress}::${moduleName}::create_document`,
          functionArguments: [cid, signerAddresses],
        }
      };
      await signAndSubmitTransaction(payload);
      setIsModalVisible(false);
      setFile(null);
      setSigners("");
      fetchDocuments();
    } catch (error) {
      console.error("Error creating document:", error);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleShare = (docId: number) => {
    const signingLink = `${window.location.origin}/sign/${docId}`;
    navigator.clipboard.writeText(signingLink).then(() => {
      message.success('Signing link copied to clipboard!');
    }, (err) => {
      console.error('Could not copy text: ', err);
    });
  };

  const handleViewDocument = async (cid: string) => {
    try {
      const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
      const response = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const objectUrl = URL.createObjectURL(blob);
      setViewDocumentUrl(objectUrl);
    } catch (error) {
      console.error("Error fetching document:", error);
      message.error("Failed to fetch the document. Please try again.");
    }
  };
    const renderDocumentCard = (doc: Document, isPending: boolean) => (
      <div 
        key={doc.id} 
        className="bg-white shadow-md rounded-lg p-4 sm:p-6 flex flex-col space-y-3 transition-all duration-300 hover:shadow-lg"
      >
        <div className="flex flex-col">
          <p className="text-sm font-medium mb-1">
            Status: <span className={doc.is_completed ? 'text-green-600' : 'text-yellow-600'}>
              {doc.is_completed ? 'Completed' : 'Pending'}
            </span>
          </p>
          <p className="text-sm text-gray-600 mb-3">
            Signatures: {doc.signatures.length}/{doc.signers.length}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Button 
            onClick={() => handleViewDocument(doc.content_hash)} 
            type="primary" 
            block
            className="w-full sm:w-auto"
          >
            View Document
          </Button>
          {isPending ? (
            <Button 
              type="primary" 
              onClick={() => navigate(`/sign/${doc.id}`)} 
              block
              className="w-full sm:w-auto"
            >
              Sign Document
            </Button>
          ) : (
            <Button 
              onClick={() => handleShare(doc.id)} 
              icon={<ShareAltOutlined />} 
              block
              className="w-full sm:w-auto"
            >
              Share
            </Button>
          )}
        </div>
      </div>
    );

    return (
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-center sm:text-left w-full">
              HashSign
            </h1>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center sm:justify-end">
              <Button
                onClick={() => setIsModalVisible(true)}
                type="primary"
                icon={<TiDocumentAdd className='text-white h-5 w-5' />}
                className=" sm:w-auto"
              >
                Create Document
              </Button>
              <WalletSelector />
            </div>    
          </div>
          
          <Tabs 
            defaultActiveKey="1" 
            centered
            tabBarStyle={{ marginBottom: '1rem' }}
            className="w-full"
          >
            <TabPane tab="Your Documents" key="1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map(doc => renderDocumentCard(doc, false))}
                {documents.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-8">
                    No documents found. Create your first document!
                  </div>
                )}
              </div>
            </TabPane>
            <TabPane tab="Pending Signatures" key="2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingDocuments.map(doc => renderDocumentCard(doc, true))}
                {pendingDocuments.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-8">
                    No pending documents to sign.
                  </div>
                )}
              </div>
            </TabPane>
          </Tabs>

          <Modal
            title="Create New Document"
            open={isModalVisible}
            onOk={handleCreateDocument}
            onCancel={() => setIsModalVisible(false)}
            confirmLoading={transactionInProgress}
            className="responsive-modal"
          >
            <div className="flex flex-col space-y-4">
              <Upload
                beforeUpload={(file) => {
                  const isLt25M = file.size / 1024 / 1024 < 25;
                  if (!isLt25M) {
                    message.error('File must be smaller than 25MB!');
                  } else {
                    setFile(file);
                  }
                  return false;
                }}
                className="w-full"
              >
                <Button 
                  icon={<UploadOutlined />} 
                  className="w-full"
                >
                  Select File (Max: 25MB)
                </Button>
              </Upload>
              <Input
                placeholder="Enter signer addresses (comma-separated)"
                value={signers}
                onChange={(e) => setSigners(e.target.value)}
                className="w-full"
              />
            </div>
          </Modal>

          <Modal
            title="View Document"
            open={!!viewDocumentUrl}
            onCancel={() => setViewDocumentUrl(null)}
            footer={null}
            width="90%"
            className="responsive-modal"
          >
            {viewDocumentUrl && (
              <iframe
                src={viewDocumentUrl}
                style={{ 
                  width: '100%', 
                  height: '70vh', 
                  border: 'none', 
                  maxHeight: '600px' 
                }}
                title="Document Viewer"
              />
            )}
          </Modal>
        </div>
    );
};

export default ContractManagement;