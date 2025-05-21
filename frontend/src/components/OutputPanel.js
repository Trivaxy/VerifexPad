import React from 'react';
import styled from 'styled-components';
import { useTheme } from '../contexts/ThemeContext';

const OutputContainer = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
  font-size: 17px; /* ~20% larger than default */
  overflow: hidden;
`;

const OutputHeader = styled.div`
  padding: 8px 12px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  font-weight: bold;
  font-size: 17px; /* ~20% larger than default */
  background-color: ${props => props.theme.colors.surface};
`;

const OutputContent = styled.pre`
  flex: 1;
  padding: 12px;
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
`;

const ErrorText = styled.span`
  color: ${props => props.theme.colors.error};
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
`;

const SuccessText = styled.span`
  color: ${props => props.theme.colors.success};
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
`;

const OutputPanel = ({ result }) => {
  const { theme } = useTheme();
  const { success, output, error } = result;

  return (
    <OutputContainer theme={theme}>
      <OutputHeader theme={theme}>
        {success !== undefined && (
          success ? 
            <SuccessText theme={theme}>Compilation Successful</SuccessText> : 
            <ErrorText theme={theme}>Compilation Failed</ErrorText>
        )}
      </OutputHeader>
      <OutputContent>
        {error && <ErrorText theme={theme}>{error}</ErrorText>}
        {output && output}
        {!error && !output && "Run your code to see output here."}
      </OutputContent>
    </OutputContainer>
  );
};

export default OutputPanel;