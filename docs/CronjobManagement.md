---
title: Cronjob Management
resourceType: Documentation
personas:
  - Developer
tags:
  - openshift
  - ha
  - maintenance
  - cronjobs
  - devops
description: Running cronjobs in a community-minded way.
---

# Cronjob Management

Cronjobs are a common and useful tool on Openshift, just as they are on any legacy platform.
There are, however, a few key things to note about how cronjobs work in a containerized platform that development teams should consider when running cronjobs.

## How Openshift Cronjobs Work

A cronjob is scheduled on Openshift in almost exactly the same way as it would be on a normal server, using the same `* * * * *` format.
However, instead of spinning up a file to be run on the given schedule, a cronjob on Openshift spins up a new pod to perform the task in question.
This has its pros and cons.

The benefit is likely rather obvious: you don't have a pod running, taking up resources, unless the cronjob is actually running.
Once the scheduled moment hits, the system spins up a pod, performs the task, and then shuts right back down again, leaving your quota free for you to use in other ways.

The drawback, however, is that you're required to spin up a pod every time you want to run the job, which creates a little overhead on each job.
Now, this isn't a concern if you're only running the job twice a day.
However, if you have more stars in your schedule than anything else, you may run into an issue where you have a new pod spinning up every single minute.
This is no longer an acceptable amount of overhead, and may even interfere with the correct running of the job itself as well as placing unnecessary strain on the platform as a whole.

## How Can I Find Out If My CronJobs Run Too Often?

### Cronjobs Scheduled Too Often

We don't have a handy rule-of-thumb to decide how often is too often - while it would be nice to say "any job that runs more often than once every 15 minutes," the reality is that it depends on the nature of the job.

If you find that you need to run a cronjob every minute, the Platform Team has decided that you *cannot* do this using the Openshift cronjob object.
If every minute is necessary for your app, you *must* use a persistent pod.

Outside of this limitation, however, we are not going to provide specific limits on what counts as "too often" or "too long" and which *require* action on your part.
There is a reason why teams on this platform are given so much freedom to make their own decisions - we trust you to be educated on best practices, to be community-minded, and to understand your application better than we ever could.
**Use your own best judgement when deciding if your cronjob runs too often.**
And remember that this is a shared platform - don't use more resources than you actually require.

To check and see what cronjobs you have on your project that run very often, try this command:

`oc get cronjob | grep -E '\* \* \* \* \*|\*/1' | grep -v True`

This version of the command will only pull up those cronjobs running once per minute - if you want to find cronjobs with other schedules, just adjust the grep filter accordingly.

### Cronjobs with a Bad Ratio of Work to Overhead

Another way to determine whether your cronjobs run too often is to consider how much platform overhead they require.
This can be calculated in terms of work per hour, like so:

First, you must determine how long your job takes to run, and determine how much time per hour it spends running, like so:
`Job work = 5 seconds x 4 times per hour = 20 seconds per hour`

Then, determine how long it takes the pod to spin up every time it runs:
`Overhead work = 1 minute x 4 times per hour = 4 minutes per hour`

Because the overhead of spinning up the pod requires more work than actually running the job does, it may be better for your job (and for the platform) if you simply put this job onto a persistent pod and ensure that the pod is running with extremely low requests.

On the other hand, if you end up with a job that runs only once per day and takes a significant amount of time to run, you might end up with a calculation that looks more like this:

```bash
Job work = 20 minutes x 1 time per day = 20 minutes per day
Overhead work = 1 minute x 1 time per day = 1 minute per day
```

In this case, the job work is significantly *higher* than the overhead work - this is the kind of cronjob where spinning up a pod is clearly worthwhile.

Again, we can't really give you specific numbers regarding what ratio of work to overhead is the correct "cut-off" point - it still depends on the needs of the app.
However, if your overhead is higher than your actual cronjob work, it's definitely time to consider whether a persistent pod would be a better choice.

## What Do I Do If I Have A Cronjob That Runs Often?

The first and most obvious question is whether it *needs* to run that often. If not, that's a very easy fix!

But often, there is a very good reason why a cronjob would need to run so regularly. We are absolutely not asking that you reduce the regularity of such jobs, especially not if it would negatively impact your application in some way.
In this situation, the correct solution is to put your cronjon into a **persistent pod**.
This just means that, instead of spinning up a new pod every time the platform tries to run your job, it spins up one pod, one time, and that pod stays up, running the job repeatedly.
This eliminates the need for a pod to bounce up and down very often.

There are a number of ways to approach creating this kind of persistent pod.

A good option might be [Jobber](https://hub.docker.com/_/jobber) - the platform team has not made extensive use of this, but development teams are welcome to test it (or any other solution) out as a problem.
If your team finds a good solution that works well, we invite you to include a link to your deployment config on this document!

There is also an example of a long-running pod that implements a cronjob in the [backup container](https://github.com/BCDevOps/backup-container).
