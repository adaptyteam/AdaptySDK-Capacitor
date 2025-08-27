import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Gender } from '@adapty/capacitor';

// Types for the context state
interface ProfileState {
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthday: string;
}

// Types for the context actions
interface ProfileActions {
  setEmail: (value: string) => void;
  setPhoneNumber: (value: string) => void;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setGender: (value: Gender) => void;
  setBirthday: (value: string) => void;
  resetProfile: () => void;
}

// Combined context type
type ProfileContextType = ProfileState & ProfileActions;

// Default state values
const defaultState: ProfileState = {
  email: 'john@example.com',
  phoneNumber: '+14325671098',
  firstName: 'John',
  lastName: 'Doe',
  gender: Gender.Other,
  birthday: '1990-01-01',
};

// Create the context
const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// Provider component props
interface ProfileProviderProps {
  children: ReactNode;
}

// Provider component
export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [email, setEmail] = useState<string>(defaultState.email);
  const [phoneNumber, setPhoneNumber] = useState<string>(defaultState.phoneNumber);
  const [firstName, setFirstName] = useState<string>(defaultState.firstName);
  const [lastName, setLastName] = useState<string>(defaultState.lastName);
  const [gender, setGender] = useState<Gender>(defaultState.gender);
  const [birthday, setBirthday] = useState<string>(defaultState.birthday);

  // Utility function to reset profile data
  const resetProfile = () => {
    setEmail(defaultState.email);
    setPhoneNumber(defaultState.phoneNumber);
    setFirstName(defaultState.firstName);
    setLastName(defaultState.lastName);
    setGender(defaultState.gender);
    setBirthday(defaultState.birthday);
  };

  const value: ProfileContextType = {
    // State
    email,
    phoneNumber,
    firstName,
    lastName,
    gender,
    birthday,

    // Actions
    setEmail,
    setPhoneNumber,
    setFirstName,
    setLastName,
    setGender,
    setBirthday,
    resetProfile,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

// Custom hook to use the profile context
export const useProfileContext = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return context;
};
