import { AdaptyCapacitorPlugin } from '@adapty/capacitor';

window.testEcho = () => {
    const inputValue = document.getElementById("echoInput").value;
    AdaptyCapacitorPlugin.echo({ value: inputValue })
}
