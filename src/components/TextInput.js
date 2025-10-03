import React from 'react';

const TextInput = ({ 
    className = '', 
    value, 
    setValue, 
    setChange, 
    handleKeyDown, 
    placeholder,
    ...props 
}) => {
    const handleChange = (e) => {
        setValue(e.target.value);
        if (setChange) setChange(true);
    };

    return (
        <input
            type="text"
            className={`glass-input ${className}`}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            {...props}
        />
    );
};

export default TextInput;