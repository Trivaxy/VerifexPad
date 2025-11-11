import React from 'react';
import styled from 'styled-components';
import examples from '../examples/examples';
import { useTheme } from '../contexts/ThemeContext';

const Container = styled.div`
  display: flex;
  padding: 10px;
  background-color: ${props => props.theme.colors.surface};
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const Title = styled.h1`
  color: ${props => props.theme.colors.text};
  margin: 0;
  font-size: 1.5rem;
`;

const Controls = styled.div`
  display: flex;
  gap: 10px;
`;

const Button = styled.button`
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 2px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => props.theme.colors.primaryHover};
  }

  &:disabled {
    background-color: ${props => props.theme.name === 'dark' ? '#4d4d4d' : '#cccccc'};
    cursor: not-allowed;
  }
`;

const ReferenceButton = styled(Button)`
  background-color: ${props => props.isActive 
    ? props.theme.colors.accent 
    : props.theme.colors.secondary};

  &:hover {
    background-color: ${props => props.isActive 
      ? props.theme.colors.accentHover 
      : props.theme.colors.secondaryHover};
  }
`;

const ThemeButton = styled(Button)`
  background-color: ${props => props.theme.colors.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;

  &:hover {
    background-color: ${props => props.theme.colors.secondaryHover};
  }

  svg {
    width: 16px;
    height: 16px;
    margin-right: 6px;
  }
`;

const GithubButton = styled(Button)`
  text-decoration: none;
  display: flex;
  align-items: center;

  &:hover {
    background-color: ${props => props.theme.colors.primaryHover};
  }
`;

const Select = styled.select`
  background-color: ${props => props.theme.name === 'dark' ? '#3c3c3c' : '#f0f0f0'};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.name === 'dark' ? '#3c3c3c' : '#dddddd'};
  padding: 8px 12px;
  border-radius: 2px;
  cursor: pointer;
`;

const ControlPanel = ({ onRun, onSelectExample, isRunning, showReference, onToggleReference }) => {
  const { theme, toggleTheme } = useTheme();
  
  const handleExampleChange = (e) => {
    const selectedIndex = e.target.value;
    if (selectedIndex >= 0) {
      onSelectExample(examples[selectedIndex].code);
    }
  };

  return (
    <Container theme={theme}>
      <Title theme={theme}>VerifexPad</Title>
      <Controls>
        <GithubButton
          as="a"
          href="https://github.com/Trivaxy/Verifex"
          target="_blank"
          rel="noopener noreferrer"
          theme={theme}
        >
          GitHub
        </GithubButton>
        <ThemeButton onClick={toggleTheme} theme={theme}>
          {theme.name === 'dark' 
            ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z" />
                </svg>
                Light
              </>
            ) 
            : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
                </svg>
                Dark
              </>
            )
          }
        </ThemeButton>
        <ReferenceButton
          onClick={onToggleReference}
          isActive={showReference}
          theme={theme}
        >
          {showReference ? 'Playground' : 'Language Reference'}
        </ReferenceButton>
        {!showReference && (
          <>
            <Select onChange={handleExampleChange} defaultValue="" theme={theme}>
              <option value="" disabled>
                Select Example
              </option>
              {examples.map((example, index) => (
                <option key={index} value={index}>
                  {example.name}
                </option>
              ))}
            </Select>
            <Button onClick={onRun} disabled={isRunning} theme={theme}>
              {isRunning ? 'Running...' : 'Run Code'}
            </Button>
          </>
        )}
      </Controls>
    </Container>
  );
};

export default ControlPanel;
