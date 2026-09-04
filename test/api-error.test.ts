import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apiErrorMessage } from '../frontend/src/lib/api-error.ts';

describe('apiErrorMessage', () => {
  it('joins class-validator arrays', () => {
    assert.equal(
      apiErrorMessage(
        { response: { data: { message: ['email must be an email', 'min'] } } },
        'fallback',
      ),
      'email must be an email. min',
    );
  });

  it('explains a down API', () => {
    assert.match(
      apiErrorMessage({ message: 'Network Error' }, 'Ошибка регистрации'),
      /Сервер недоступен/,
    );
  });

  it('uses string message from Nest', () => {
    assert.equal(
      apiErrorMessage(
        { response: { data: { message: 'Email уже зарегистрирован' } } },
        'fallback',
      ),
      'Email уже зарегистрирован',
    );
  });
});
