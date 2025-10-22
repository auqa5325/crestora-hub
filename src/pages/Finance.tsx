import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard,
  Banknote,
  PieChart,
  BarChart3,
  Receipt,
  Plus,
  Download,
  Trophy
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiService, DashboardStats } from "@/services/api";
import { useState } from "react";

const Finance = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  const { data: dashboardStats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiService.getDashboardStats(),
    refetchInterval: 30000,
  });

  // Mock financial data - in real app, this would come from API
  const mockFinancialData = {
    total_budget: 15000,
    total_expenses: 2400,
    remaining_budget: 12600,
    prize_pool: 12600,
    expenses: [
      {
        id: 1,
        category: "Venue",
        description: "Main auditorium booking",
        amount: 800,
        date: "2025-10-15",
        status: "paid",
        receipt: "receipt_001.pdf"
      },
      {
        id: 2,
        category: "Equipment",
        description: "Sound system rental",
        amount: 500,
        date: "2025-10-16",
        status: "paid",
        receipt: "receipt_002.pdf"
      },
      {
        id: 3,
        category: "Marketing",
        description: "Posters and banners",
        amount: 300,
        date: "2025-10-17",
        status: "pending",
        receipt: null
      },
      {
        id: 4,
        category: "Refreshments",
        description: "Snacks for participants",
        amount: 400,
        date: "2025-10-18",
        status: "paid",
        receipt: "receipt_003.pdf"
      },
      {
        id: 5,
        category: "Transportation",
        description: "Guest speaker travel",
        amount: 400,
        date: "2025-10-19",
        status: "pending",
        receipt: null
      }
    ],
    prize_breakdown: [
      {
        position: 1,
        prize: "First Place",
        amount: 5000,
        description: "Championship trophy + cash prize"
      },
      {
        position: 2,
        prize: "Second Place",
        amount: 3000,
        description: "Runner-up trophy + cash prize"
      },
      {
        position: 3,
        prize: "Third Place",
        amount: 2000,
        description: "Third place trophy + cash prize"
      },
      {
        position: 4,
        prize: "Best Innovation",
        amount: 1000,
        description: "Special recognition award"
      },
      {
        position: 5,
        prize: "Best Presentation",
        amount: 1000,
        description: "Presentation excellence award"
      },
      {
        position: 6,
        prize: "Audience Choice",
        amount: 600,
        description: "Popular vote winner"
      }
    ]
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case "paid":
        return "Paid";
      case "pending":
        return "Pending";
      case "overdue":
        return "Overdue";
      default:
        return status;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Venue":
        return <Banknote className="h-4 w-4" />;
      case "Equipment":
        return <CreditCard className="h-4 w-4" />;
      case "Marketing":
        return <PieChart className="h-4 w-4" />;
      case "Refreshments":
        return <Receipt className="h-4 w-4" />;
      case "Transportation":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Finance</h1>
              <p className="text-muted-foreground">Loading financial data...</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Finance</h1>
            <p className="text-muted-foreground">
              Budget management and expense tracking
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button className="gradient-hero">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{mockFinancialData.total_budget.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Allocated funds
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">₹{mockFinancialData.total_expenses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Spent so far
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining Budget</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{mockFinancialData.remaining_budget.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Available funds
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prize Pool</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">₹{mockFinancialData.prize_pool.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                For winners
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="prizes" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Prize Pool
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            {/* Expense Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Expense Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="venue">Venue</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="refreshments">Refreshments</SelectItem>
                        <SelectItem value="transportation">Transportation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Period</Label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="All time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="last_month">Last Month</SelectItem>
                        <SelectItem value="this_quarter">This Quarter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expenses List */}
            <div className="space-y-4">
              {mockFinancialData.expenses.map((expense) => (
                <Card key={expense.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {getCategoryIcon(expense.category)}
                        </div>
                        <div>
                          <h3 className="font-semibold">{expense.description}</h3>
                          <p className="text-sm text-muted-foreground">{expense.category}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(expense.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">₹{expense.amount.toLocaleString()}</div>
                        <Badge variant="outline" className={getStatusColor(expense.status)}>
                          {formatStatus(expense.status)}
                        </Badge>
                        {expense.receipt && (
                          <Button variant="outline" size="sm" className="mt-2">
                            <Download className="h-3 w-3 mr-1" />
                            Receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="prizes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Prize Pool Breakdown
                </CardTitle>
                <CardDescription>
                  Total prize pool: ₹{mockFinancialData.prize_pool.toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockFinancialData.prize_breakdown.map((prize) => (
                    <div key={prize.position} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full font-bold">
                          {prize.position}
                        </div>
                        <div>
                          <h3 className="font-semibold">{prize.prize}</h3>
                          <p className="text-sm text-muted-foreground">{prize.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          ₹{prize.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Expense by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(
                      mockFinancialData.expenses.reduce((acc, expense) => {
                        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([category, amount]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(category)}
                          <span className="text-sm">{category}</span>
                        </div>
                        <span className="font-semibold">₹{amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Budget Utilization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Expenses</span>
                        <span>₹{mockFinancialData.total_expenses.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full" 
                          style={{ width: `${(mockFinancialData.total_expenses / mockFinancialData.total_budget) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Prize Pool</span>
                        <span>₹{mockFinancialData.prize_pool.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${(mockFinancialData.prize_pool / mockFinancialData.total_budget) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Remaining</span>
                        <span>₹{mockFinancialData.remaining_budget.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${(mockFinancialData.remaining_budget / mockFinancialData.total_budget) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Finance;
