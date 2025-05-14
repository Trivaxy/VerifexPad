import React from 'react';
import styled from 'styled-components';
import examples from '../examples/examples';

const Container = styled.div`
  display: flex;
  padding: 10px;
  background-color: #252526;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
`;

const Title = styled.h1`
  color: #d4d4d4;
  margin: 0;
  font-size: 1.5rem;
`;

const Controls = styled.div`
  display: flex;
  gap: 10px;
`;

const Button = styled.button`
  background-color: #0e639c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 2px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;

  &:hover {
    background-color: #1177bb;
  }

  &:disabled {
    background-color: #4d4d4d;
    cursor: not-allowed;
  }
`;

const ReferenceButton = styled(Button)`
  background-color: ${props => props.isActive ? '#6a329f' : '#414141'};

  &:hover {
    background-color: ${props => props.isActive ? '#7c4dba' : '#525252'};
  }
`;

const Select = styled.select`
  background-color: #3c3c3c;
  color: #d4d4d4;
  border: 1px solid #3c3c3c;
  padding: 8px 12px;
  border-radius: 2px;
  cursor: pointer;
`;

const ControlPanel = ({ onRun, onSelectExample, isRunning, showReference, onToggleReference }) => {
  const handleExampleChange = (e) => {
    const selectedIndex = e.target.value;
    if (selectedIndex >= 0) {
      onSelectExample(examples[selectedIndex].code);
    }
  };

  return (
    <Container>
      <Title>VerifexPad</Title>
      <Controls>
        <ReferenceButton
          onClick={onToggleReference}
          isActive={showReference}
        >
          {showReference ? 'Playground' : 'Language Reference'}
        </ReferenceButton>
        {!showReference && (
          <>
            <Select onChange={handleExampleChange} defaultValue="">
              <option value="" disabled>
                Select Example
              </option>
              {examples.map((example, index) => (
                <option key={index} value={index}>
                  {example.name}
                </option>
              ))}
            </Select>
            <Button onClick={onRun} disabled={isRunning}>
              {isRunning ? 'Running...' : 'Run Code'}
            </Button>
          </>
        )}
      </Controls>
    </Container>
  );
};

export default ControlPanel;