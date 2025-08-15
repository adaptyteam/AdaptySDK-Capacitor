import { useEffect, useState } from 'react';
import { adapty, Gender } from '@adapty/capacitor';
import { useProfileContext } from '../../contexts/ProfileContext';
import styles from './Profile.module.css';

function Profile() {
  // Get profile context state and actions
  const {
    email,
    phoneNumber,
    firstName,
    lastName,
    gender,
    birthday,
    setEmail,
    setPhoneNumber,
    setFirstName,
    setLastName,
    setGender,
    setBirthday,
  } = useProfileContext();

  // Local state for temporary/UI state that should not persist
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [result, setResult] = useState<string>('');


  useEffect(() => {
    let isMounted = true;
    adapty
      .isActivated()
      .then((active) => {
        if (isMounted) setIsActivated(active);
      })
      .catch(() => {
        if (isMounted) setIsActivated(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateProfile = async () => {
    if (!isActivated) {
      setResult('Error: SDK is not activated');
      return;
    }

    try {
      await adapty.updateProfile({
        params: { email, phoneNumber, firstName, lastName, gender, birthday },
      });
      setResult('Profile updated successfully');
    } catch (error) {
      setResult(`Error updating profile: ${error}`);
    }
  };

  return (
    <div className={styles.AppContainer}>
      <div className={styles.ProfileHeader}>
        <h2 className={styles.ProfileTitle}>Update Profile</h2>
      </div>
      <div className={styles.Section}>
        <div className={styles.InputGroup}>
          <input className={styles.Input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        </div>
        <div className={styles.InputGroup}>
          <input className={styles.Input} type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="phone number" />
        </div>
        <div className={styles.InputGroup}>
          <input className={styles.Input} type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="first name" />
        </div>
        <div className={styles.InputGroup}>
          <input className={styles.Input} type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="last name" />
        </div>
        <div className={styles.InputGroup}>
          <select className={styles.Input} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value={Gender.Female}>Female</option>
            <option value={Gender.Male}>Male</option>
            <option value={Gender.Other}>Other</option>
          </select>
        </div>
        <div className={styles.InputGroup}>
          <input className={styles.Input} type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} placeholder="birthday" />
        </div>
        <div className={styles.ButtonGroup}>
          <button className={`${styles.Button} ${styles.ButtonPrimary}`} onClick={updateProfile} disabled={!isActivated}>
            Update Profile
          </button>
        </div>
        {result ? (
          <div className={`${styles.ResultBox} ${result.startsWith('Error') ? styles.ResultBoxError : styles.ResultBoxSuccess}`}>
            {result}
          </div>
        ) : null}
        {!isActivated ? (
          <div className={styles.MutedNote}>
            Activate SDK on the main screen before updating profile
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Profile;
