interface AbstractMap<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
}

export function getOrCreate<K, V>(map: AbstractMap<K, V>, key: K, construct: (key: K) => V): V {
  let result = map.get(key);
  if (!result) {
    result = construct(key);
    map.set(key, result);
  }
  return result;
}
