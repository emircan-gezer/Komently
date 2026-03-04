import React from 'react';

export function Form(props: React.FormHTMLAttributes<HTMLFormElement>) {
  const { className = '', ...rest } = props;
  return <form {...rest} className={`komently-form ${className}`.trim()} />;
}

export default Form;

