To uninject 
```kubectl get -n emojivoto deploy -o yaml | linkerd uninject - | kubectl delete -f -```

To inject  
```kubectl get -n emojivoto deploy -o yaml | linkerd inject -  | kubectl apply -f -```

```
kubectl wait --timeout=5m -n emojivoto deployment --all
linkerd viz stat service -n emojivoto
linkerd viz stat deployment -n emojivoto
linkerd viz stat namespace
```


```
NAME          MESHED   SUCCESS       RPS   LATENCY_P50   LATENCY_P95   LATENCY_P99   TCP_CONN
booksapp         6/6    81.22%   23.9rps          14ms          69ms          94ms         26
emojivoto        4/4    94.58%    6.2rps           1ms           1ms           2ms         10
linkerd          3/3   100.00%    2.3rps           1ms           1ms           4ms         61
linkerd-viz      5/5   100.00%    3.1rps           1ms           1ms           3ms         22
```

You'll also see these in the Linkerd Viz dashboard, labeled the same way. These columns show latencies at the 50th, 95th, and 99th percentiles:

The latency at which 95 percent of requests were at or under.


LATENCY_P50 is the minimum latency in which 50% of requests complete
LATENCY_P95 is the minimum latency in which 95% of requests complete
LATENCY_P99 is the minimum latency in which 99% of requests complete

The P50 latency provides a good sense of the average latency for a given workload or set of workloads; the P95 and P99 latencies provide a good sense of how outliers behave. In a perfect world, all three will be low and close together.

If the P50 latency rises, but P95 and P99 are close to P50, this tends to indicate that the workload as a whole is slowing down. It may be taking too much traffic, or it may be starved more CPU. Alternately, perhaps the incoming requests have become more complex.

If the P50 latency stays the same, but P95 and P99 start rising, this tends to indicate a need to focus on outliers: perhaps a particular code path has gotten slower or is failing, or perhaps another microservice that isn't used for every request is having issues.



linkerd viz stat deployment -n emojivoto
NAME       MESHED   SUCCESS      RPS   LATENCY_P50   LATENCY_P95   LATENCY_P99   TCP_CONN
emoji         1/1   100.00%   2.3rps           1ms           3ms           4ms          3
vote-bot      1/1   100.00%   0.3rps           1ms           2ms           2ms          1
voting        1/1    89.74%   1.3rps           1ms           2ms           3ms          3
web           1/1    94.81%   2.2rps           3ms          14ms          19ms          3

linkerd viz top -n emojivoto deployment/web

Source                     Destination             Method      Path                                                       Count    Best   Worst    Last  Success Rate
web-6c5b7bb685-qdmrb       emoji-79d94b5dcb-sbm2c  POST        /emojivoto.v1.EmojiService/ListAll                           235     1ms     9ms     2ms       100.00%
vote-bot-5dd8699f6f-n5rf8  web-6c5b7bb685-qdmrb    GET         /api/list                                                    235     3ms    18ms     5ms       100.00%
web-6c5b7bb685-qdmrb       emoji-79d94b5dcb-sbm2c  POST        /emojivoto.v1.EmojiService/FindByShortcode                   235   995µs     7ms     2ms       100.00%
vote-bot-5dd8699f6f-n5rf8  web-6c5b7bb685-qdmrb    GET         /api/vote                                                    235     5ms    32ms     6ms        85.11%
web-6c5b7bb685-qdmrb       voting-99fd4c49f-hflw5  POST        /emojivoto.v1.VotingService/VoteDoughnut                      35     1ms    14ms     3ms         0.00%
web-6c5b7bb685-qdmrb       voting-99fd4c49f-hflw5  POST        /emojivoto.v1.VotingService/VoteBacon                          5     2ms     3ms     2ms       100.00%

linkerd viz top -n emojivoto deployment/voting
Source                Destination             Method      Path                                                    Count    Best   Worst    Last  Success Rate
web-6c5b7bb685-qdmrb  voting-99fd4c49f-hflw5  POST        /emojivoto.v1.VotingService/VoteDoughnut                   12   528µs     1ms   551µs         0.00%
web-6c5b7bb685-qdmrb  voting-99fd4c49f-hflw5  POST        /emojivoto.v1.VotingService/VotePager                       5   872µs     2ms     2ms       100.00%
web-6c5b7bb685-qdmrb  voting-99fd4c49f-hflw5  POST        /emojivoto.v1.VotingService/VotePrincess                    3   793µs     1ms   793µs       100.00%




---
Pode facilitar encontrar erros baseados em usuarios se no path incluir o usuario especifico



---
mTLS part



linkerd identity -n <namespace> <podname>
   
output look for

Subject: CN=web.emojivoto.serviceaccount.identity.linkerd.cluster.local

the results here is a public information.


Why do we issue short-lived TLS certificates?
To reduce the impact of certificate leaks.

In the context of TLS, why is authenticity important?
It ensures that the other identity is who is says it is.



---- Handling with fails

to create some profile
```linkerd profile -n emojivoto web-svc --template```

Request retries: Automatically retry requests that have failed for a particular request, potentially sending them to a different pod.
Request timeouts: Cut off individual requests that are taking too long instead of waiting indefinitely for the service to respond.
Circuit breaking: Cut off all requests to a service that is returning errors in order to give it a chance to recover.
Intelligent load balancing: Send requests to the best pod to handle them, e.g. the fastest pod or the one processing the fewest requests.
Progressive delivery: When a new version of a service comes online, gradually send it traffic to assess whether it is functioning as expected.
Failover. If a service in one cluster fails, automatically send traffic to the same service in another cluster.

kubectl scale -n faces deploy/face --replicas=2


Circuit breaking

Unlike with load balancing, which is done purely automatically, these three features all require explicit configuration to be enabled. For example, to enable retries for a service in Linkerd, you create a ServiceProfile resource:

```
apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  creationTimestamp: null
  name: Foo
  namespace: foo
spec:
  routes:
  - name: GET /api/annotations
    condition:
      method: GET
      pathRegex: /api/annotations
    isRetryable: true
```

 It’s important to configure this on a per-route basis because not all requests are safe to retry!

 By default, retries may add at most an additional 20% to the request load (plus an additional 10 “free” retries per second).


kubectl get serviceprofile -n faces smiley.faces.svc.cluster.local -o yaml


```
apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  annotations:
    kubectl.kubernetes.io/last-applied-configuration: |
      {"apiVersion":"linkerd.io/v1alpha2","kind":"ServiceProfile","metadata":{"annotations":{},"creationTimestamp":null,"name":"smiley.faces.svc.cluster.local","namespace":"faces"},"spec":{"routes":[{"condition":{"method":"GET","pathRegex":"/"},"name":"GET /"}]}}
  creationTimestamp: "2023-06-25T14:47:17Z"
  generation: 1
  name: smiley.faces.svc.cluster.local
  namespace: faces
  resourceVersion: "1267"
  uid: cfd8ba17-5ed6-4aa7-b01a-92599427b7d6
spec:
  routes:
  - condition:
      method: GET
      pathRegex: /
    name: GET /
```


linkerd viz -n faces routes svc/smiley

```
ROUTE       SERVICE   SUCCESS      RPS   LATENCY_P50   LATENCY_P95   LATENCY_P99
GET /        smiley    81.56%   6.4rps          21ms        1661ms        1932ms
[DEFAULT]    smiley         -        -             -             -             -

```

Enabling retrie

```
kubectl apply -f - <<EOF
---
apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  creationTimestamp: null
  name: smiley.faces.svc.cluster.local
  namespace: faces
spec:
  routes:
  - condition:
      method: GET
      pathRegex: /
    name: GET /
    isRetryable: true
EOF
```


```

kubectl apply -f - <<EOF
---
apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  creationTimestamp: null
  name: color.faces.svc.cluster.local
  namespace: faces
spec:
  routes:
  - condition:
      method: GET
      pathRegex: /
    name: GET /
    isRetryable: true
EOF

```


timeout
linkerd viz -n faces routes svc/smiley


```
ROUTE       SERVICE   SUCCESS      RPS   LATENCY_P50   LATENCY_P95   LATENCY_P99
GET /        smiley    80.13%   7.9rps          25ms        1528ms        1906ms
[DEFAULT]    smiley         -        -             -             -             -

```


```

kubectl apply -f - <<EOF
---
apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  creationTimestamp: null
  name: color.faces.svc.cluster.local
  namespace: faces
spec:
  routes:
  - condition:
      method: GET
      pathRegex: /
    name: GET /
    isRetryable: true
    timeout: 300ms
EOF
```

Timeouts Increase Load
Once again, it's important to realize that timeouts are not about protecting the workload. If you check the route metrics at this point, you'll still see elevated traffic to the smiley and color workloads, but you'll see much lower P95 and P99 latencies.

```
linkerd viz -n faces routes svc/smiley
ROUTE       SERVICE   SUCCESS      RPS   LATENCY_P50   LATENCY_P95   LATENCY_P99
GET /        smiley    77.86%   6.4rps          18ms         259ms         292ms
[DEFAULT]    smiley         -        -             -             -             -

```


Enabling Circuit Breaking
Where retries and timeouts use the ServiceProfile for configuration, circuit breaking uses annotations on the Service itself:

```balancer.linkerd.io/failure-accrual``` sets the circuit breaking mode. Currently, the only supported mode is consecutive, to break the circuit after a certain number of consecutive failures.

```balancer.linkerd.io/failure-accrual-consecutive-max-failures``` sets the number of consecutive failures before the breaker opens. If not set, the default is 7.

```balancer.linkerd.io/failure-accrual-consecutive-min-penalty``` sets the minimum time the breaker will be open. If not set, the default is one second.

```balancer.linkerd.io/failure-accrual-consecutive-max-penalty``` sets the maximum time the breaker will be open. If not set, the default is 60 seconds.



Circuit Breaking and the Faces Demo
For this demo, we'll set things up as follows:

enable consecutive-failures circuit breaking;
set max-failures to 10, which is slightly less aggressive than the default;
set min-penalty to 10s, so that it's easier to see the breaker working;
leave max-penalty at 60s.



kubectl annotate -n faces svc/face balancer.linkerd.io/failure-accrual=consecutive balancer.linkerd.io/failure-accrual-consecutive-max-failures=30 balancer.linkerd.io/failure-accrual-consecutive-min-penalty=10s
