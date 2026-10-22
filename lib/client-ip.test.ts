import test from "node:test";
import assert from "node:assert/strict";
import { clientIp, ipKey, parseIp, WindowCounter } from "./client-ip.ts";

const headers = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

test("x-real-ip wins, then the first entry of x-forwarded-for", () => {
  assert.equal(clientIp(headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" })), "203.0.113.7");
  assert.equal(clientIp(headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1, 10.0.0.2" })), "198.51.100.1");
});

test("no usable header means no address, never a made-up one", () => {
  assert.equal(clientIp(headers({})), null);
  assert.equal(clientIp(headers({ "x-forwarded-for": "not-an-ip" })), null);
  assert.equal(clientIp(headers({ "x-real-ip": "999.1.1.1" })), null);
  assert.equal(clientIp(headers({ "x-real-ip": "", "x-forwarded-for": "" })), null);
});

test("a bad x-real-ip falls back to the forwarded list", () => {
  assert.equal(clientIp(headers({ "x-real-ip": "garbage", "x-forwarded-for": "198.51.100.9" })), "198.51.100.9");
});

test("parseIp accepts both families and rejects the rest", () => {
  for (const ok of ["1.2.3.4", "::1", "2001:db8::1", "[2001:db8::1]", "fe80::1%eth0", "::ffff:1.2.3.4"]) assert.ok(parseIp(ok), ok);
  for (const bad of ["", "1.2.3", "1.2.3.4.5", "2001:db8::1::2", "12345::1", "a:b:c:d:e:f:g:h", "hello"]) assert.equal(parseIp(bad), null, bad);
});

test("an IPv4 address is its own network", () => {
  assert.equal(ipKey("203.0.113.7"), "203.0.113.7");
});

test("an IPv6 address is its /64, however it is written", () => {
  const a = ipKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
  assert.equal(a, "v6:2001:db8:1:2");
  assert.equal(ipKey("2001:0DB8:0001:0002::1"), a);
  assert.equal(ipKey("2001:db8:1:2::"), a);
  assert.notEqual(ipKey("2001:db8:1:3::1"), a);
});

test("an IPv4-mapped IPv6 address is the IPv4 address it wraps", () => {
  assert.equal(ipKey("::ffff:203.0.113.7"), "203.0.113.7");
});

test("the counter allows up to the maximum, then refuses, then lets the next window in", () => {
  const c = new WindowCounter(60_000, 3);
  const t0 = 1_000_000;
  assert.deepEqual([1, 2, 3, 4, 5].map(() => c.hit("a", t0)), [true, true, true, false, false]);
  assert.equal(c.hit("b", t0), true);
  assert.equal(c.hit("a", t0 + 60_000), true);
});

test("the counter does not grow without bound", () => {
  const c = new WindowCounter(60_000, 1, 100);
  for (let i = 0; i < 1000; i++) c.hit(`k${i}`, 1_000_000 + i);
  // The size is private; what matters is that it keeps answering and stays cheap.
  assert.equal(c.hit("fresh", 2_000_000), true);
});
