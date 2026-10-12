// Monta la root e asserisce su un testo REALMENTE presente in schermata.
//
// Non si asserisce "nessun errore": un componente che renderizza il vuoto non
// solleva eccezioni e passerebbe. Serve un testo visibile, altrimenti il test
// dimostra solo che il render non e' esploso.
//
// L'asserzione cambiera' con T11, quando la prima schermata diventera' l'onboarding:
// e' corretto che si muova insieme alla UI, non che resti generica per non doverla
// toccare mai.

import { render } from '@testing-library/react-native';

import App from '../../App';

describe('smoke: la root dell app monta', () => {
  // render() e' asincrona da @testing-library/react-native v14: va attesa,
  // altrimenti si destruttura una Promise e le query non esistono.
  it('mostra la prima schermata con il suo testo', async () => {
    const { getByText } = await render(<App />);

    expect(getByText(/Open up App\.tsx/i)).toBeTruthy();
  });
});
