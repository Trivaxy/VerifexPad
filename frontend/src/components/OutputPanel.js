import React from 'react';
import styled from 'styled-components';

const OutputContainer = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
  color: #d4d4d4;
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
  font-size: 17px; /* ~20% larger than default */
  overflow: hidden;
`;

const OutputHeader = styled.div`
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  font-weight: bold;
  font-size: 17px; /* ~20% larger than default */
  background-color: #252526;
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
  color: #f48771;
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
`;

const SuccessText = styled.span`
  color: #89d185;
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
`;

const OutputPanel = ({ result }) => {
  const { success, output, error } = result;

  return (
    <OutputContainer>
      <OutputHeader>
        {success !== undefined && (
          success ? 
            <SuccessText>Compilation Successful</SuccessText> : 
            <ErrorText>Compilation Failed</ErrorText>
        )}
      </OutputHeader>
      <OutputContent>
        {error && <ErrorText>{error}</ErrorText>}
        {output && output}
        {!error && !output && "Run your code to see output here."}
      </OutputContent>
    </OutputContainer>
  );
};

export default OutputPanel;