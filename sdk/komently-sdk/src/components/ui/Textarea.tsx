import React from 'react';

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return <textarea {...rest} className={`komently-textarea ${className}`.trim()} />;
}

export default Textarea;


