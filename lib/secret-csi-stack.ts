import { CfnJson, NestedStack, NestedStackProps, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Cluster, KubernetesManifest } from 'aws-cdk-lib/aws-eks';


interface SecretCsiStackProps extends NestedStackProps {
    cluster: Cluster,
    environment: string;
}


export class SecretCsiStack extends NestedStack {


    constructor(scope: Construct, id: string, props: SecretCsiStackProps) {
        super(scope, id, props);


        const sa = props.cluster.addServiceAccount("csi-secret-sa-account", {
            namespace: "kube-system",
            name: "secrets-store-csi-driver"
        });

        sa.role.attachInlinePolicy(new iam.Policy(this, "csi-secret-sa-policy", {
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        "secretsmanager:GetSecretValue",
                        "secretsmanager:DescribeSecret",
                        "ssm:GetParameters",
                        "ssm:GetParameter"
                    ],
                    resources: ["*"]
                })
            ]
        }));

        https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/main/charts/secrets-store-csi-driver/templates/role.yaml
        props.cluster.addManifest('csi-cluster-role', {
            "apiVersion": "rbac.authorization.k8s.io/v1",
            "kind": "ClusterRole",
            "metadata": {
                "creationTimestamp": null,
                "name": "secretproviderclasses-role",
                "annotations": {
                    "managed-by": "aws-cdk"
                },
                "labels": {
                    "ManagedBy": "AWS-CDK"
                }
            },
            "rules": [
                {
                    "apiGroups": [
                        ""
                    ],
                    "resources": [
                        "events"
                    ],
                    "verbs": [
                        "create",
                        "patch"
                    ]
                },
                {
                    "apiGroups": [
                        ""
                    ],
                    "resources": [
                        "pods", 
                        "nodes",
                        "serviceaccounts"

                    ],
                    "verbs": [
                        "get",
                        "list",
                        "watch"
                    ]
                },
                {
                    "apiGroups": [
                        ""
                    ],
                    "resources": [
                        "serviceaccounts/token"

                    ],
                    "verbs": [
                        "create"
                    ]
                },
                {
                    "apiGroups": [
                        "secrets-store.csi.x-k8s.io"
                    ],
                    "resources": [
                        "secretproviderclasses"
                    ],
                    "verbs": [
                        "get",
                        "list",
                        "watch"
                    ]
                },
                {
                    "apiGroups": [
                        "secrets-store.csi.x-k8s.io"
                    ],
                    "resources": [
                        "secretproviderclasspodstatuses"
                    ],
                    "verbs": [
                        "create",
                        "delete",
                        "get",
                        "list",
                        "patch",
                        "update",
                        "watch"
                    ]
                },
                {
                    "apiGroups": [
                        "secrets-store.csi.x-k8s.io"
                    ],
                    "resources": [
                        "secretproviderclasspodstatuses/status"
                    ],
                    "verbs": [
                        "get",
                        "patch",
                        "update"
                    ]
                }
            ]

        })

        // https://github.com/kubernetes-sigs/secrets-store-csi-driver/blob/main/charts/secrets-store-csi-driver/templates/role_binding.yaml

        props.cluster.addManifest('csi-cluster-role-binding', {

            "apiVersion": "rbac.authorization.k8s.io/v1",
            "kind": "ClusterRoleBinding",
            "metadata": {
                "name": "secretproviderclasses-rolebinding",
                "annotations": {
                    "managed-by": "aws-cdk"
                }
            },
            "roleRef": {
                "apiGroup": "rbac.authorization.k8s.io",
                "kind": "ClusterRole",
                "name": "secretproviderclasses-role"
            },
            "subjects": [
                {
                    "kind": "ServiceAccount",
                    "name": "secrets-store-csi-driver",
                    "namespace": "kube-system"
                }
            ]

        });

        https://secrets-store-csi-driver.sigs.k8s.io/getting-started/installation.html
        new eks.HelmChart(this, "csi-secrets-store-chart", {
            version: "1.0.0",
            release: "secrets-store-csi-driver",
            cluster: props.cluster,
            chart: "secrets-store-csi-driver",
            repository: "https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts",
            namespace: "kube-system",
            createNamespace: false,
            values: {
                "rbac": {
                    "install": false
                },
                "syncSecret": {
                    "enabled": true,
                }
            },
        });

        // https://artifacthub.io/packages/helm/aws/csi-secrets-store-provider-aws
        new eks.HelmChart(this, "csi-secrets-store-provider-aws-chart", {
            version: "0.0.1",
            release: "csi-secrets-store-provider-aws",
            cluster: props.cluster,
            chart: "csi-secrets-store-provider-aws",
            repository: "https://aws.github.io/eks-charts",
            namespace: "kube-system",
            createNamespace: false,
            values: {
                clusterName: props.cluster.clusterName,
                "rbac": {
                    "install": false,
                    "serviceAccount": {
                        "name": sa.serviceAccountName
                    }
                }
            },
        });

    

        const nginxTestParameter = new ssm.StringParameter(this, "nginx-test-parameter", {
            parameterName: "/nginx-test-parameter",
            stringValue: "test"
        });

        const testnamespace = props.cluster.addManifest('test-namespace', {
            "apiVersion": "v1",
            "kind": "Namespace",
            "metadata": {
                "name": "secret"
            }
        });
    
        const testsa = props.cluster.addServiceAccount("test-csi-controller", {
            namespace: "secret",
            name: "nginx-deployment-sa"
        });
        testsa.node.addDependency(testnamespace);

        testsa.role.attachInlinePolicy(new iam.Policy(this, "test-csi-controller-policy", {
            statements: [
                new iam.PolicyStatement({
                    actions: ["ssm:GetParameters", "secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
                    resources: [nginxTestParameter.parameterArn]
                })
            ]
        }));



    }
}
