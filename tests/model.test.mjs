import assert from 'node:assert/strict'
import { test } from 'node:test'
import { day, monday, seed, status } from '../src/model.ts'

test('seed includes two schools, all four moods, and two appointments today', () => {
  const state = seed()
  assert.equal(state.contacts.length, 6)
  assert.equal(new Set(state.contacts.map(contact => contact.school)).size, 2)
  assert.deepEqual(new Set(state.contacts.map(contact => status(contact, state.interactions).mood)), new Set([0, 1, 2, 3]))
  assert.equal(state.appointments.filter(row => row.date === day()).length, 2)
  assert.equal(state.suggestions.length, 6)
})

test('Monday starts a new contact week in local time', () => {
  const sunday = new Date(2026, 10, 22, 23, 59)
  const next = new Date(2026, 10, 23, 0, 0)
  const contact = { id: 'test', last_contact: day(0, sunday), frequency_mode: 'interval', frequency_value: 2 }
  const interactions = [{ contact_id: contact.id, date: day(0, sunday) }]
  assert.equal(monday(sunday), '2026-11-16')
  assert.equal(status(contact, interactions, sunday).linked, true)
  assert.equal(monday(next), '2026-11-23')
  assert.equal(status(contact, interactions, next).linked, false)
})

test('weekly goal counts local-week records and a same-day follow-up restores mood', () => {
  const saturday = new Date(2026, 10, 21, 12)
  const contact = { id: 'test', last_contact: day(-3, saturday), frequency_mode: 'weekly', frequency_value: 3 }
  const interactions = [{ contact_id: contact.id, date: day(-3, saturday) }]
  assert.equal(status(contact, interactions, saturday).mood, 2)
  const today = day(0, saturday)
  assert.deepEqual(status({ ...contact, last_contact: today }, [...interactions, { contact_id: contact.id, date: today }], saturday), { elapsed: 0, count: 2, mood: 0, overdue: 1 / 3, linked: true })
})
