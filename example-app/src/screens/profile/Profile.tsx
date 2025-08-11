import React, { useEffect, useState } from 'react';
import { adapty } from '@adapty/capacitor';
import styles from './Profile.module.css';

function Profile() {
  const [email, setEmail] = useState<string>('john@example.com');
  const [phoneNumber, setPhoneNumber] = useState<string>('+14325671098');
  const [firstName, setFirstName] = useState<string>('John');
  const [lastName, setLastName] = useState<string>('Doe');
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
        params: { email, phoneNumber, firstName, lastName },
      });
      setResult('Profile updated successfully');
    } catch (error) {
      setResult(`Error updating profile: ${error}`);
    }
  };

  return (
    <div className={styles.AppContainer}>
      <div className={styles.Section}>
        <h3 className={styles.SectionTitle}>Update Profile</h3>
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
