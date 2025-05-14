import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import api from '../services/api';

const ReferenceContainer = styled.div`
  padding: 20px;
  overflow: auto;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #1e1e1e;
  color: #d4d4d4;
  line-height: 1.6;
  font-size: 1.1rem;
`;

const MarkdownContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;

  h1, h2, h3, h4, h5, h6 {
    color: #9cdcfe;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  h1 {
    font-size: 2.5rem;
    border-bottom: 1px solid #333;
    padding-bottom: 0.5rem;
  }

  h2 {
    font-size: 2rem;
  }

  h3 {
    font-size: 1.7rem;
  }

  p {
    margin: 1em 0;
    font-size: 1.1rem;
  }

  code {
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 1rem;
  }

  a {
    color: #569cd6;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }

  ul, ol {
    padding-left: 2em;
    margin: 1em 0;
    font-size: 1.1rem;
  }

  blockquote {
    margin: 1em 0;
    padding-left: 1em;
    border-left: 3px solid #569cd6;
    color: #aaa;
  }

  hr {
    border: 0;
    border-top: 1px solid #333;
    margin: 2em 0;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    
    th, td {
      padding: 0.5em;
      border: 1px solid #333;
    }
    
    th {
      background-color: #2d2d2d;
    }
  }
  
  /* Style for code blocks */
  pre {
    margin: 0.5em 0;
    overflow: hidden;
    /* Remove border and other styling from pre since we're styling the inner element */
  }

  /* This targets the SyntaxHighlighter component */
  .prism-code {
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 1rem !important;
    border-radius: 6px !important;
    background-color: #161616 !important;
    padding: 1em !important;
  }
`;

const Loading = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 1.2rem;
`;

const Reference = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReference = async () => {
      try {
        setLoading(true);
        const response = await api.getReference();
        setContent(response.content);
        setError(null);
      } catch (err) {
        console.error('Error fetching reference:', err);
        setError('Failed to load the language reference. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchReference();
  }, []);

  if (loading) {
    return <Loading>Loading language reference...</Loading>;
  }

  if (error) {
    return <ReferenceContainer>{error}</ReferenceContainer>;
  }

  return (
    <ReferenceContainer>
      <MarkdownContainer>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  className="code-block"
                  customStyle={{
                    backgroundColor: '#161616',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '1rem',
                    borderRadius: '6px',
                    margin: '0.25em 0',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                    border: '1px solid #333',
                  }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </MarkdownContainer>
    </ReferenceContainer>
  );
};

export default Reference;