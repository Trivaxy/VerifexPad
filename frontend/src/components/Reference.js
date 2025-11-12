import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const ReferenceContainer = styled.div`
  padding: 20px;
  overflow: auto;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  line-height: 1.6;
  font-size: 1.1rem;
`;

const MarkdownContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;

  h1, h2, h3, h4, h5, h6 {
    color: ${props => props.theme.name === 'dark' ? '#9cdcfe' : '#0078d4'};
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  h1 {
    font-size: 2.5rem;
    border-bottom: 1px solid ${props => props.theme.colors.border};
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
    background-color: ${props => props.theme.name === 'dark' ? '#2d2d2d' : '#f0f0f0'};
  }

  a {
    color: ${props => props.theme.name === 'dark' ? '#569cd6' : '#0078d4'};
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
    border-left: 3px solid ${props => props.theme.name === 'dark' ? '#569cd6' : '#0078d4'};
    color: ${props => props.theme.name === 'dark' ? '#aaa' : '#666'};
  }

  hr {
    border: 0;
    border-top: 1px solid ${props => props.theme.colors.border};
    margin: 2em 0;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    
    th, td {
      padding: 0.5em;
      border: 1px solid ${props => props.theme.colors.border};
    }
    
    th {
      background-color: ${props => props.theme.name === 'dark' ? '#2d2d2d' : '#f3f3f3'};
    }
  }
  
  /* Style for code blocks */
  pre {
    margin: 0.5em 0;
    overflow: hidden;
    /* Remove border and other styling from pre since we're styling the inner element */
  }

  pre,
  pre code {
    background-color: ${props => props.theme.colors.codeBackground} !important;
  }

  pre code {
    display: block;
    width: 100%;
    margin: 0;
    padding: 0;
    background: transparent !important;
    color: inherit;
    font-family: inherit;
    line-height: inherit;
  }

  /* This targets the SyntaxHighlighter component */
  .prism-code {
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 1rem !important;
    border-radius: 6px !important;
    background-color: ${props => props.theme.colors.codeBackground} !important;
    padding: 1em !important;
    border: 1px solid ${props => props.theme.colors.border} !important;
  }
`;

const Loading = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text};
`;

const Reference = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { theme } = useTheme();

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
    return <Loading theme={theme}>Loading language reference...</Loading>;
  }

  if (error) {
    return <ReferenceContainer theme={theme}>{error}</ReferenceContainer>;
  }

  return (
    <ReferenceContainer theme={theme}>
      <MarkdownContainer theme={theme}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={theme.name === 'dark' ? vscDarkPlus : vs}
                  language={match[1]}
                  PreTag="div"
                  className="code-block"
                  customStyle={{
                    backgroundColor: theme.colors.codeBackground,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '1rem',
                    borderRadius: '6px',
                    margin: '0.25em 0',
                    boxShadow: theme.name === 'dark' 
                      ? '0 4px 8px rgba(0, 0, 0, 0.3)' 
                      : '0 2px 4px rgba(0, 0, 0, 0.1)',
                    border: `1px solid ${theme.colors.border}`,
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
