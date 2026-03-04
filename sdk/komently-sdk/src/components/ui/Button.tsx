import React from 'react';

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return <button {...rest} className={`komently-button ${className}`.trim()} />;
}

export default Button;


