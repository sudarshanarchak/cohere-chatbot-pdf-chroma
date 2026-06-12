import { useRef, useState, useEffect, type ChangeEvent } from 'react';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Document } from 'langchain/document';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function Home() {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
    pendingSourceDocs?: Document[];
  }>({
    messages: [
      {
        message: 'Hey, what would you like to learn today from your repository?',
        type: 'apiMessage',
      },
    ],
    history: [],
  });

  const { messages, history } = messageState;

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  //handle form submission
  async function handleSubmit(e: any) {
    e.preventDefault();

    setError(null);

    if (!query) {
      alert('Please enter a question');
      return;
    }

    const question = query.trim();

    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: question,
        },
      ],
    }));

    setLoading(true);
    setQuery('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          history,
        }),
      });
      const data = await response.json();
      console.log('data', data);

      if (data.error) {
        setError(data.error);
      } else {
        setMessageState((state) => ({
          ...state,
          messages: [
            ...state.messages,
            {
              type: 'apiMessage',
              message: data.text,
              sourceDocs: data.sourceDocuments,
            },
          ],
          history: [...state.history, [question, data.text]],
        }));
      }
      console.log('messageState', messageState);

      setLoading(false);

      //scroll to bottom
      messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
    } catch (error) {
      setLoading(false);
      setError('An error occurred while fetching the data. Please try again.');
      console.log('error', error);
    }
  }

  //prevent empty submissions
  const handleEnter = (e: any) => {
    if (e.key === 'Enter' && query) {
      handleSubmit(e);
    } else if (e.key == 'Enter') {
      e.preventDefault();
    }
  };

  async function handlePdfUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Please choose a PDF file.');
      e.target.value = '';
      return;
    }

    setError(null);
    setUploadMessage(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to upload PDF.');
      }

      setUploadMessage(
        `${file.name} uploaded and ingested. You can ask questions from it now.`,
      );
    } catch (error: any) {
      setError(error.message || 'An error occurred while uploading the PDF.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <>
      <Layout>
        <div className={styles.pageShell}>
          <div className={styles.hero}>
            <p className={styles.eyebrow}>Document intelligence workspace</p>
            <h1 className={styles.title}>Find Answers in Your Documents</h1>
          </div>
          <div className={styles.uploadPanel}>
            <div>
              <label htmlFor="pdfUpload" className={styles.uploadLabel}>
                Upload a PDF
              </label>
              <p className={styles.uploadHint}>
                The document will be saved and ingested automatically.
              </p>
            </div>
            <input
              ref={fileInputRef}
              id="pdfUpload"
              type="file"
              accept=".pdf,application/pdf"
              disabled={uploading || loading}
              onChange={handlePdfUpload}
              className={styles.fileInput}
            />
          </div>
          {uploading && (
            <div className={styles.uploadProgressWrap}>
              <div className={styles.uploadProgress} />
              <p className={styles.uploadStatus}>
                Uploading and ingesting PDF...
              </p>
            </div>
          )}
          {uploadMessage && (
            <div className={styles.uploadSuccess}>
              <p>{uploadMessage}</p>
            </div>
          )}
          <main className={styles.main}>
            <div className={styles.cloud}>
              <div ref={messageListRef} className={styles.messagelist}>
                {messages.map((message, index) => {
                  let icon;
                  let className;
                  if (message.type === 'apiMessage') {
                    icon = (
                      <Image
                        key={index}
                        src="/bot-image.png"
                        alt="AI"
                        width="40"
                        height="40"
                        className={styles.boticon}
                        priority
                      />
                    );
                    className = styles.apimessage;
                  } else {
                    icon = (
                      <Image
                        key={index}
                        src="/usericon.png"
                        alt="Me"
                        width="30"
                        height="30"
                        className={styles.usericon}
                        priority
                      />
                    );
                    // The latest message sent by the user will be animated while waiting for a response
                    className =
                      loading && index === messages.length - 1
                        ? styles.usermessagewaiting
                        : styles.usermessage;
                  }
                  return (
                    <>
                      <div key={`chatMessage-${index}`} className={className}>
                        {icon}
                        <div className={styles.markdownanswer}>
                          <ReactMarkdown>
                            {message.message}
                          </ReactMarkdown>
                        </div>
                      </div>
                       {message.sourceDocs && (
                         <div
                           className="p-5"
                           key={`sourceDocsAccordion-${index}`}
                         >
                           <Accordion
                             type="single"
                             collapsible
                             className="flex-col"
                           >
                             {message.sourceDocs.map((doc, docIndex) => (
                               <AccordionItem key={`messageSourceDocs-${docIndex}`} value={`item-${docIndex}`}>
                                 <AccordionTrigger>
                                   <h3>Source {docIndex + 1}</h3>
                                 </AccordionTrigger>
                                 <AccordionContent>
                                   <ReactMarkdown>
                                     {doc.pageContent}
                                   </ReactMarkdown>
                                   <p className="mt-2">
                                     <b>Source:</b> {doc.metadata.source}
                                   </p>
                                 </AccordionContent>
                               </AccordionItem>
                             ))}
                           </Accordion>
                         </div>
                       )}
                    </>
                  );
                })}
              </div>
            </div>
            <div className={styles.center}>
              <div className={styles.cloudform}>
                <form onSubmit={handleSubmit}>
                  <textarea
                    disabled={loading || uploading}
                    onKeyDown={handleEnter}
                    ref={textAreaRef}
                    autoFocus={false}
                    rows={1}
                    maxLength={512}
                    id="userInput"
                    name="userInput"
                    placeholder={
                      loading
                        ? 'Waiting for response...'
                        : uploading
                          ? 'Ingesting your PDF...'
                        : 'What are the courses offered at TheSkillPedia.com?'
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={styles.textarea}
                  />
                  <button
                    type="submit"
                    disabled={loading || uploading}
                    className={styles.generatebutton}
                  >
                    {loading ? (
                      <div className={styles.loadingwheel}>
                        <LoadingDots color="#fff" />
                      </div>
                    ) : (
                      // Send icon SVG in input field
                      <svg
                        viewBox="0 0 20 20"
                        className={styles.svgicon}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </div>
            {error && (
              <div className="border border-red-400 rounded-md p-4">
                <p className="text-red-500">{error}</p>
              </div>
            )}
          </main>
        </div>
        <footer className={styles.footer}>
          <a href="https://twitter.com/TheSkillPedia">
            Powered by LangChainAI. Learn Generative AI TheSkillPedia (Twitter: @TheSkillPedia).
          </a>
        </footer>
      </Layout>
    </>
  );
}
